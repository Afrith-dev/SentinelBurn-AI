import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ReportService } from '../services/report.service';

export const reportsRouter = Router();

reportsRouter.get('/runs/:id/report', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const reportData = ReportService.generateLotReport(req.params.id);
    res.json(reportData);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

reportsRouter.get('/runs/:id/report/html', (req: AuthRequest, res: Response) => {
  try {
    const reportData = ReportService.generateLotReport(req.params.id);
    res.setHeader('Content-Type', 'text/html');
    res.send(reportData.htmlReport);
  } catch (err: any) {
    res.status(404).send(`<h1>Error generating report: ${err.message}</h1>`);
  }
});
