import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { CopilotService } from '../services/copilot.service';
import { GeminiLiveService } from '../services/gemini-live.service';

export const copilotRouter = Router();

copilotRouter.get('/copilot/gemini/status', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    res.json(GeminiLiveService.getStatus());
  } catch (err: any) {
    console.error('Gemini status check failed:', err);
    res.status(500).json({
      configured: false,
      mode: 'fallback',
      model: '',
      liveModel: '',
      message: 'Gemini status check failed.'
    });
  }
});

copilotRouter.post('/copilot/gemini/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const result = await GeminiLiveService.generateTextResponse(prompt);
    res.json(result);
  } catch (err: any) {
    console.error('Gemini text test failed:', err);
    res.status(500).json({
      mode: 'fallback',
      text: 'Gemini fallback active: ' + (err.message || 'Unable to reach Gemini.')
    });
  }
});

copilotRouter.post('/copilot/query', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { query, runId, pendingActionId, sessionId } = req.body;
    if (!query && !pendingActionId) {
      return res.status(400).json({ error: 'Query or pendingActionId required' });
    }

    const response = await CopilotService.processQuery({
      query: query || '',
      runId,
      userRole: req.user?.role,
      userName: req.user?.name,
      userId: req.user?.id,
      sessionId: sessionId || req.user?.id,
      pendingActionId
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
