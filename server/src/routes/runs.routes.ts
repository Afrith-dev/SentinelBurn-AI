import { Router, Response } from 'express';
import axios from 'axios';
import { db } from '../database/store';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AuditService } from '../services/audit.service';
import { SocketHandler } from '../socket/socketHandler';
import { ENV } from '../config/env';
import { Lot, Run, Device } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { SimulatorService } from '../services/simulator.service';

export const runsRouter = Router();

// --------------------------------------------------------------------------
// Lots Endpoints
// --------------------------------------------------------------------------

runsRouter.get('/lots', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(Array.from(db.lots.values()));
});

runsRouter.post('/lots', authenticateToken, (req: AuthRequest, res: Response) => {
  const { partNumber, manufacturer, dateCode, specReference, quantity } = req.body;
  if (!partNumber || !manufacturer || !quantity) {
    return res.status(400).json({ error: 'partNumber, manufacturer, and quantity are required' });
  }

  const lotId = `lot-${Date.now().toString().slice(-6)}`;
  const newLot: Lot = {
    id: lotId,
    partNumber,
    manufacturer,
    dateCode: dateCode || '2615-BATCH',
    specReference: specReference || 'ISRO-PAS-206 Rev D',
    quantity: Number(quantity),
    createdBy: req.user?.id || 'u-rel-01',
    createdAt: new Date().toISOString()
  };

  db.lots.set(lotId, newLot);
  res.status(201).json(newLot);
});

// --------------------------------------------------------------------------
// Runs Endpoints
// --------------------------------------------------------------------------

runsRouter.get('/runs', authenticateToken, (req: AuthRequest, res: Response) => {
  const allRuns = Array.from(db.runs.values()).map(r => ({
    ...r,
    lot: r.lotId ? db.lots.get(r.lotId) : undefined,
    deviceCount: db.runDevices.get(r.id)?.length || 0,
    alertCount: Array.from(db.alerts.values()).filter(a => a.runId === r.id).length
  }));
  res.json(allRuns);
});

runsRouter.post('/runs', authenticateToken, (req: AuthRequest, res: Response) => {
  const { lotId, speedMultiplier, anomalyRate, deviceCount } = req.body;
  if (!lotId || !db.lots.has(lotId)) {
    return res.status(400).json({ error: 'Valid lotId is required' });
  }

  const runId = `run-${Date.now().toString().slice(-6)}`;
  const lot = db.lots.get(lotId)!;
  const numDevices = deviceCount || lot.quantity || 200;

  const newRun: Run = {
    id: runId,
    lotId,
    lot,
    status: 'created',
    speedMultiplier: Number(speedMultiplier) || 60.0,
    startedAt: undefined,
    createdAt: new Date().toISOString(),
    elapsedHours: 0.0,
    anomalyInjectionConfig: {
      anomalyRate: Number(anomalyRate) || 0.05
    }
  };

  db.runs.set(runId, newRun);

  // Initialize DUT records
  const deviceIds: string[] = [];
  for (let i = 1; i <= numDevices; i++) {
    const devId = `d-${String(i).padStart(4, '0')}`;
    deviceIds.push(devId);
    const dev: Device = {
      id: devId,
      runId,
      deviceSerial: `${lot.partNumber}-${String(i).padStart(4, '0')}`,
      channelId: i,
      cohortBaselineJson: {
        nominalVoltage: 5.0,
        nominalCurrent: 0.18,
        nominalLeakage: 0.0025,
        nominalTemp: 125.0
      },
      createdAt: new Date().toISOString()
    };
    db.devices.set(`${runId}:${devId}`, dev);
  }
  db.runDevices.set(runId, deviceIds);

  AuditService.logEvent({
    runId,
    eventType: 'RUN_CREATED',
    actorId: req.user?.id,
    actorName: req.user?.name,
    fromState: undefined,
    toState: 'created',
    payload: { lotId, deviceCount: numDevices, speedMultiplier: newRun.speedMultiplier }
  });

  res.status(201).json(newRun);
});

runsRouter.get('/runs/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const run = db.runs.get(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  // Ensure telemetry stream is active if run is in running state
  if (run.status === 'running') {
    SimulatorService.startRun(run.id);
  }

  const lot = run.lotId ? db.lots.get(run.lotId) : undefined;
  const deviceIds = db.runDevices.get(run.id) || [];
  const alertCount = Array.from(db.alerts.values()).filter(a => a.runId === run.id).length;

  res.json({
    ...run,
    lot,
    deviceCount: deviceIds.length,
    alertCount
  });
});

runsRouter.post('/runs/:id/start', authenticateToken, async (req: AuthRequest, res: Response) => {
  const run = db.runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const prevStatus = run.status;
  run.status = 'running';
  run.startedAt = run.startedAt || new Date().toISOString();

  AuditService.logEvent({
    runId: run.id,
    eventType: 'RUN_STARTED',
    actorId: req.user?.id,
    actorName: req.user?.name,
    fromState: prevStatus,
    toState: 'running',
    payload: { speedMultiplier: run.speedMultiplier }
  });

  SocketHandler.broadcastRunStatusChanged(run.id, { runId: run.id, status: 'running' });

  // Start internal in-process telemetry simulator engine
  SimulatorService.startRun(run.id);

  // Also notify external simulator if configured
  try {
    const devCount = db.runDevices.get(run.id)?.length || 200;
    await axios.post(`${ENV.SIMULATOR_URL}/simulator/start`, {
      runId: run.id,
      deviceCount: devCount,
      anomalyRate: run.anomalyInjectionConfig?.anomalyRate || 0.05,
      speedMultiplier: run.speedMultiplier,
      backendUrl: `http://localhost:${ENV.PORT}/api/ingest/telemetry`
    }, { timeout: 1000 });
  } catch (e) {
    // External simulator not available, in-process engine is active
  }

  res.json({ status: 'running', run });
});

runsRouter.post('/runs/:id/pause', authenticateToken, async (req: AuthRequest, res: Response) => {
  const run = db.runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const newStatus = run.status === 'paused' ? 'running' : 'paused';
  const prevStatus = run.status;
  run.status = newStatus;

  AuditService.logEvent({
    runId: run.id,
    eventType: newStatus === 'paused' ? 'RUN_PAUSED' : 'RUN_RESUMED',
    actorId: req.user?.id,
    actorName: req.user?.name,
    fromState: prevStatus,
    toState: newStatus
  });

  SocketHandler.broadcastRunStatusChanged(run.id, { runId: run.id, status: newStatus });

  if (newStatus === 'paused') {
    SimulatorService.pauseRun(run.id);
  } else {
    SimulatorService.startRun(run.id);
  }

  try {
    await axios.post(`${ENV.SIMULATOR_URL}/simulator/pause`, {}, { timeout: 1000 });
  } catch (e) {}

  res.json({ status: newStatus, run });
});

runsRouter.post('/runs/:id/complete', authenticateToken, async (req: AuthRequest, res: Response) => {
  const run = db.runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const prevStatus = run.status;
  run.status = 'completed';
  run.endedAt = new Date().toISOString();

  AuditService.logEvent({
    runId: run.id,
    eventType: 'RUN_COMPLETED',
    actorId: req.user?.id,
    actorName: req.user?.name,
    fromState: prevStatus,
    toState: 'completed',
    payload: { elapsedHours: run.elapsedHours }
  });

  SocketHandler.broadcastRunStatusChanged(run.id, { runId: run.id, status: 'completed' });
  SimulatorService.stopRun(run.id);

  try {
    await axios.post(`${ENV.SIMULATOR_URL}/simulator/stop`, {}, { timeout: 1000 });
  } catch (e) {}

  res.json({ status: 'completed', run });
});

// --------------------------------------------------------------------------
// Audit Trail & Verification
// --------------------------------------------------------------------------

runsRouter.get('/runs/:id/audit', authenticateToken, (req: AuthRequest, res: Response) => {
  const logs = AuditService.getRunLogs(req.params.id);
  res.json(logs);
});

runsRouter.get('/runs/:id/audit/verify', authenticateToken, (req: AuthRequest, res: Response) => {
  const result = AuditService.verifyRunChain(req.params.id);
  res.json(result);
});
