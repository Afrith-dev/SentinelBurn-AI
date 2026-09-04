import { Router, Response } from 'express';
import { db } from '../database/store';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { AuditService } from '../services/audit.service';
import { MLService } from '../services/ml.service';
import { SocketHandler } from '../socket/socketHandler';
import { Disposition } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const devicesRouter = Router();

devicesRouter.get('/runs/:id/devices', authenticateToken, (req: AuthRequest, res: Response) => {
  const runId = req.params.id;
  const deviceIds = db.runDevices.get(runId) || [];
  
  const devices = deviceIds.map(dId => {
    const dev = db.devices.get(`${runId}:${dId}`);
    if (!dev) return null;
    const disposition = db.dispositions.get(dev.id);
    return {
      ...dev,
      disposition
    };
  }).filter(Boolean);

  res.json(devices);
});

devicesRouter.get('/runs/:id/devices/:deviceId', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id: runId, deviceId } = req.params;
  const dev = db.devices.get(`${runId}:${deviceId}`);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const history = db.getTelemetryHistory(runId, deviceId);
  const disposition = db.dispositions.get(dev.id);

  res.json({
    ...dev,
    history,
    disposition
  });
});

devicesRouter.get('/runs/:id/devices/:deviceId/telemetry', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id: runId, deviceId } = req.params;
  const history = db.getTelemetryHistory(runId, deviceId);
  res.json(history);
});

devicesRouter.get('/runs/:id/devices/:deviceId/explain', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id: runId, deviceId } = req.params;
  const dev = db.devices.get(`${runId}:${deviceId}`);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const history = db.getTelemetryHistory(runId, deviceId);
  const latestReadings = dev.latestReadings || history[history.length - 1]?.readings || {
    voltage: 5.0,
    current: 0.18,
    leakageCurrent: 0.0025,
    temperature: 125.0
  };

  const scores = dev.latestScores || {
    pointScore: 0.5,
    driftScore: 0.8,
    sequenceScore: 0.6,
    ensembleScore: 78.0,
    severity: 'critical' as const,
    anomalyClassGuess: 'gradual_drift'
  };

  const explanation = await MLService.getExplanation({
    runId,
    deviceId,
    channelId: dev.channelId,
    readings: latestReadings,
    history: history.slice(-20),
    scores
  });

  res.json(explanation);
});

devicesRouter.post('/devices/:id/disposition', authenticateToken, (req: AuthRequest, res: Response) => {
  const deviceId = req.params.id;
  const { runId, decision, comment } = req.body;

  if (!runId || !decision) {
    return res.status(400).json({ error: 'runId and decision (accept|reject|hold_fa) are required' });
  }

  const devKey = `${runId}:${deviceId}`;
  const dev = db.devices.get(devKey);
  if (!dev) {
    return res.status(404).json({ error: 'Device not found for this run' });
  }

  const disposition: Disposition = {
    id: uuidv4(),
    deviceId,
    runId,
    decision,
    engineerId: req.user?.id || 'u-rel-01',
    engineerName: req.user?.name || 'Reliability Engineer',
    comment: comment || '',
    decidedAt: new Date().toISOString()
  };

  db.dispositions.set(deviceId, disposition);
  dev.disposition = disposition;

  // Append to cryptographic audit log
  AuditService.logEvent({
    runId,
    eventType: `DEVICE_DISPOSITION_${decision.toUpperCase()}`,
    actorId: req.user?.id,
    actorName: req.user?.name,
    payload: {
      deviceId,
      deviceSerial: dev.deviceSerial,
      channelId: dev.channelId,
      decision,
      comment,
      anomalyScoreAtDisposition: dev.latestScores?.ensembleScore
    }
  });

  SocketHandler.broadcastDispositionCreated(runId, disposition);

  res.json({
    status: 'recorded',
    disposition
  });
});
