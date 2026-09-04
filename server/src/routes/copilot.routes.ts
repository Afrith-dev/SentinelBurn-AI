import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { CopilotService } from '../services/copilot.service';

export const copilotRouter = Router();

copilotRouter.post('/copilot/query', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { query, runId, pendingConfirmation } = req.body;
    if (!query && !pendingConfirmation) {
      return res.status(400).json({ error: 'Query or pendingConfirmation required' });
    }

    const response = await CopilotService.processQuery({
      query: query || '',
      runId,
      userRole: req.user?.role,
      userName: req.user?.name,
      pendingConfirmation
    });

    res.json(response);
  } catch (err: any) {
    console.error('Copilot Query Error:', err);
    res.status(500).json({
      intent: 'ERROR',
      message: 'Failed to process voice copilot query: ' + (err.message || 'Internal error'),
      spokenText: 'Sorry, I encountered an error querying telemetry data.'
    });
  }
});
