import { Router, Request, Response } from 'express';
import axios from 'axios';
import { ENV } from '../config/env';
import { db } from '../database/store';
import { AuditService } from '../services/audit.service';

export const simulatorRouter = Router();

simulatorRouter.get('/simulator/status', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${ENV.SIMULATOR_URL}/simulator/status`, { timeout: 1500 });
    res.json(response.data);
  } catch (err: any) {
    res.json({
      status: 'simulator_offline',
      message: 'Simulator service is not running or unreachable',
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

  try {
    const response = await axios.post(`${ENV.SIMULATOR_URL}/simulator/inject`, {
      deviceId,
      anomalyClass,
      magnitude
    }, { timeout: 2000 });

    res.json(response.data);
  } catch (err: any) {
    res.status(500).json({
      error: 'Failed to communicate with telemetry simulator',
      detail: err.message
    });
  }
});
