import { Router, Request, Response } from 'express';
import { TelemetryService } from '../services/telemetry.service';

export const ingestRouter = Router();

ingestRouter.post('/ingest/telemetry', async (req: Request, res: Response) => {
  const { runId, elapsedHours, samples } = req.body;
  if (!runId || !Array.isArray(samples)) {
    return res.status(400).json({ error: 'runId and samples array are required' });
  }

  try {
    const result = await TelemetryService.ingestBatch(runId, elapsedHours || 0.0, samples);
    res.json({ status: 'ingested', ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to ingest telemetry batch', detail: err.message });
  }
});
