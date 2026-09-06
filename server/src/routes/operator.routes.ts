import { Router, Response } from 'express';
import { db } from '../database/store';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

export const operatorRouter = Router();

// POST /api/operator/shift-notes - Record operator handover note
operatorRouter.post('/operator/shift-notes', authenticateToken, (req: AuthRequest, res: Response) => {
  const { runId, note, author } = req.body;

  if (!runId || !note) {
    return res.status(400).json({ error: 'runId and note are required' });
  }

  const shiftNote = {
    id: uuidv4(),
    runId,
    note: String(note).trim(),
    author: author || req.user?.name || 'Floor Operator',
    timestamp: new Date().toISOString(),
  };

  const existingNotes = db.shiftNotes.get(runId) || [];
  existingNotes.unshift(shiftNote);
  db.shiftNotes.set(runId, existingNotes);

  res.status(201).json({
    message: 'Shift note recorded',
    note: shiftNote
  });
});

// GET /api/operator/shift-notes/:runId - Fetch shift notes for a run
operatorRouter.get('/operator/shift-notes/:runId', authenticateToken, (req: AuthRequest, res: Response) => {
  const { runId } = req.params;
  const notes = db.shiftNotes.get(runId) || [];
  res.json(notes);
});
