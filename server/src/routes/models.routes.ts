import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { MLService } from '../services/ml.service';

export const modelsRouter = Router();

modelsRouter.get('/models', authenticateToken, async (req: AuthRequest, res: Response) => {
  const metrics = await MLService.getModelMetrics();
  res.json(metrics);
});

modelsRouter.post('/models/retrain', authenticateToken, requireRole('admin', 'qa_manager'), async (req: AuthRequest, res: Response) => {
  const result = await MLService.triggerRetrain();
  res.json(result);
});
