import { Router, Response } from 'express';
import { db } from '../database/store';
import { authenticateToken, AuthRequest } from '../middleware/auth';

export const alertsRouter = Router();

alertsRouter.get('/runs/:id/alerts', authenticateToken, (req: AuthRequest, res: Response) => {
  const runId = req.params.id;
  const runAlerts = Array.from(db.alerts.values())
    .filter(a => a.runId === runId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(runAlerts);
});

alertsRouter.post('/alerts/:id/acknowledge', authenticateToken, (req: AuthRequest, res: Response) => {
  const alert = db.alerts.get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  alert.acknowledgedBy = req.user?.name || 'Engineer';
  alert.acknowledgedAt = new Date().toISOString();

  res.json({ status: 'acknowledged', alert });
});
