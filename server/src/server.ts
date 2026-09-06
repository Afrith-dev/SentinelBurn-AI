import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ENV } from './config/env';
import { SocketHandler } from './socket/socketHandler';

import { authRouter } from './routes/auth.routes';
import { runsRouter } from './routes/runs.routes';
import { devicesRouter } from './routes/devices.routes';
import { alertsRouter } from './routes/alerts.routes';
import { reportsRouter } from './routes/reports.routes';
import { modelsRouter } from './routes/models.routes';
import { simulatorRouter } from './routes/simulator.routes';
import { ingestRouter } from './routes/ingest.routes';
import { copilotRouter } from './routes/copilot.routes';
import { adminRouter } from './routes/admin.routes';
import { operatorRouter } from './routes/operator.routes';

const app = express();
const httpServer = http.createServer(app);

// Socket.IO configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
SocketHandler.initialize(io);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Base API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'SentinelBurn AI Backend',
    version: '1.2.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', authRouter);
app.use('/api', runsRouter);
app.use('/api', devicesRouter);
app.use('/api', alertsRouter);
app.use('/api', reportsRouter);
app.use('/api', modelsRouter);
app.use('/api', simulatorRouter);
app.use('/api', ingestRouter);
app.use('/api', copilotRouter);
app.use('/api', adminRouter);
app.use('/api', operatorRouter);

// Start server
httpServer.listen(ENV.PORT, () => {
  console.log('================================================================');
  console.log(`🛰️  SentinelBurn AI Backend Service running on port ${ENV.PORT}`);
  console.log(`📡  Socket.IO real-time ingestion bus initialized`);
  console.log(`🔒  Cryptographic SHA-256 Audit Trail active`);
  console.log('================================================================');
});
