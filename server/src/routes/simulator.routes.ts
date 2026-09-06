import { Router, Request, Response } from 'express';
import axios from 'axios';
import { ENV } from '../config/env';
import { AuditService } from '../services/audit.service';
import { SimulatorService } from '../services/simulator.service';

export const simulatorRouter = Router();

simulatorRouter.get('/simulator/status', async (req: Request, res: Response) => {
  // Check external simulator if available
  try {
    const response = await axios.get(`${ENV.SIMULATOR_URL}/simulator/status`, { timeout: 1000 });
    return res.json(response.data);
  } catch (err: any) {
    // Fall back to built-in embedded engine
    const activeRuns = SimulatorService.getActiveRunIds();
    res.json({
      status: 'active',
      mode: 'embedded_simulator_engine',
      activeRuns,
      activeDUTs: 200,
      configuredUrl: ENV.SIMULATOR_URL
    });
  }
});

simulatorRouter.post('/simulator/runs/:id/inject-anomaly', async (req: Request, res: Response) => {
  const { id: runId } = req.params;
  const { deviceId, anomalyClass, magnitude } = req.body;

  if (!deviceId || !anomalyClass) {
    return res.status(400).json({ error: 'deviceId and anomalyClass are required' });
  }

  // Audit log this intentional demonstration injection
  AuditService.logEvent({
    runId,
    eventType: 'DEMO_ANOMALY_INJECTED',
    payload: { deviceId, anomalyClass, magnitude }
  });

  // Inject into internal simulation engine
  const internalResult = SimulatorService.injectAnomaly(
    runId,
    deviceId,
    anomalyClass,
    magnitude || 2.5
  );

  // Also notify external simulator if online
  try {
    await axios.post(`${ENV.SIMULATOR_URL}/simulator/inject`, {
      deviceId,
      anomalyClass,
      magnitude
    }, { timeout: 1000 });
  } catch (err: any) {
    // Handled by in-process engine
  }

  res.json({
    message: `Anomaly ${anomalyClass} injected successfully into ${deviceId}`,
    ...internalResult
  });
});
