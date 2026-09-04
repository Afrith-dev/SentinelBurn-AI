"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const socketHandler_1 = require("./socket/socketHandler");
const auth_routes_1 = require("./routes/auth.routes");
const runs_routes_1 = require("./routes/runs.routes");
const devices_routes_1 = require("./routes/devices.routes");
const alerts_routes_1 = require("./routes/alerts.routes");
const reports_routes_1 = require("./routes/reports.routes");
const models_routes_1 = require("./routes/models.routes");
const simulator_routes_1 = require("./routes/simulator.routes");
const ingest_routes_1 = require("./routes/ingest.routes");
const copilot_routes_1 = require("./routes/copilot.routes");
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
// Socket.IO configuration
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
socketHandler_1.SocketHandler.initialize(io);
// Middleware
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)({ origin: '*' }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Base API Routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        system: 'SentinelBurn AI Backend',
        version: '1.2.0',
        timestamp: new Date().toISOString()
    });
});
app.use('/api', auth_routes_1.authRouter);
app.use('/api', runs_routes_1.runsRouter);
app.use('/api', devices_routes_1.devicesRouter);
app.use('/api', alerts_routes_1.alertsRouter);
app.use('/api', reports_routes_1.reportsRouter);
app.use('/api', models_routes_1.modelsRouter);
app.use('/api', simulator_routes_1.simulatorRouter);
app.use('/api', ingest_routes_1.ingestRouter);
app.use('/api', copilot_routes_1.copilotRouter);
// Start server
httpServer.listen(env_1.ENV.PORT, () => {
    console.log('================================================================');
    console.log(`🛰️  SentinelBurn AI Backend Service running on port ${env_1.ENV.PORT}`);
    console.log(`📡  Socket.IO real-time ingestion bus initialized`);
    console.log(`🔒  Cryptographic SHA-256 Audit Trail active`);
    console.log('================================================================');
});
