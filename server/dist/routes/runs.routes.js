"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runsRouter = void 0;
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const store_1 = require("../database/store");
const auth_1 = require("../middleware/auth");
const audit_service_1 = require("../services/audit.service");
const socketHandler_1 = require("../socket/socketHandler");
const env_1 = require("../config/env");
exports.runsRouter = (0, express_1.Router)();
// --------------------------------------------------------------------------
// Lots Endpoints
// --------------------------------------------------------------------------
exports.runsRouter.get('/lots', auth_1.authenticateToken, (req, res) => {
    res.json(Array.from(store_1.db.lots.values()));
});
exports.runsRouter.post('/lots', auth_1.authenticateToken, (req, res) => {
    const { partNumber, manufacturer, dateCode, specReference, quantity } = req.body;
    if (!partNumber || !manufacturer || !quantity) {
        return res.status(400).json({ error: 'partNumber, manufacturer, and quantity are required' });
    }
    const lotId = `lot-${Date.now().toString().slice(-6)}`;
    const newLot = {
        id: lotId,
        partNumber,
        manufacturer,
        dateCode: dateCode || '2615-BATCH',
        specReference: specReference || 'ISRO-PAS-206 Rev D',
        quantity: Number(quantity),
        createdBy: req.user?.id || 'u-rel-01',
        createdAt: new Date().toISOString()
    };
    store_1.db.lots.set(lotId, newLot);
    res.status(201).json(newLot);
});
// --------------------------------------------------------------------------
// Runs Endpoints
// --------------------------------------------------------------------------
exports.runsRouter.get('/runs', auth_1.authenticateToken, (req, res) => {
    const allRuns = Array.from(store_1.db.runs.values()).map(r => ({
        ...r,
        lot: r.lotId ? store_1.db.lots.get(r.lotId) : undefined,
        deviceCount: store_1.db.runDevices.get(r.id)?.length || 0,
        alertCount: Array.from(store_1.db.alerts.values()).filter(a => a.runId === r.id).length
    }));
    res.json(allRuns);
});
exports.runsRouter.post('/runs', auth_1.authenticateToken, (req, res) => {
    const { lotId, speedMultiplier, anomalyRate, deviceCount } = req.body;
    if (!lotId || !store_1.db.lots.has(lotId)) {
        return res.status(400).json({ error: 'Valid lotId is required' });
    }
    const runId = `run-${Date.now().toString().slice(-6)}`;
    const lot = store_1.db.lots.get(lotId);
    const numDevices = deviceCount || lot.quantity || 200;
    const newRun = {
        id: runId,
        lotId,
        lot,
        status: 'created',
        speedMultiplier: Number(speedMultiplier) || 60.0,
        startedAt: undefined,
        createdAt: new Date().toISOString(),
        elapsedHours: 0.0,
        anomalyInjectionConfig: {
            anomalyRate: Number(anomalyRate) || 0.05
        }
    };
    store_1.db.runs.set(runId, newRun);
    // Initialize DUT records
    const deviceIds = [];
    for (let i = 1; i <= numDevices; i++) {
        const devId = `d-${String(i).padStart(4, '0')}`;
        deviceIds.push(devId);
        const dev = {
            id: devId,
            runId,
            deviceSerial: `${lot.partNumber}-${String(i).padStart(4, '0')}`,
            channelId: i,
            cohortBaselineJson: {
                nominalVoltage: 5.0,
                nominalCurrent: 0.18,
                nominalLeakage: 0.0025,
                nominalTemp: 125.0
            },
            createdAt: new Date().toISOString()
        };
        store_1.db.devices.set(`${runId}:${devId}`, dev);
    }
    store_1.db.runDevices.set(runId, deviceIds);
    audit_service_1.AuditService.logEvent({
        runId,
        eventType: 'RUN_CREATED',
        actorId: req.user?.id,
        actorName: req.user?.name,
        fromState: undefined,
        toState: 'created',
        payload: { lotId, deviceCount: numDevices, speedMultiplier: newRun.speedMultiplier }
    });
    res.status(201).json(newRun);
});
exports.runsRouter.get('/runs/:id', auth_1.authenticateToken, (req, res) => {
    const run = store_1.db.runs.get(req.params.id);
    if (!run) {
        return res.status(404).json({ error: 'Run not found' });
    }
    const lot = run.lotId ? store_1.db.lots.get(run.lotId) : undefined;
    const deviceIds = store_1.db.runDevices.get(run.id) || [];
    const alertCount = Array.from(store_1.db.alerts.values()).filter(a => a.runId === run.id).length;
    res.json({
        ...run,
        lot,
        deviceCount: deviceIds.length,
        alertCount
    });
});
exports.runsRouter.post('/runs/:id/start', auth_1.authenticateToken, async (req, res) => {
    const run = store_1.db.runs.get(req.params.id);
    if (!run)
        return res.status(404).json({ error: 'Run not found' });
    const prevStatus = run.status;
    run.status = 'running';
    run.startedAt = run.startedAt || new Date().toISOString();
    audit_service_1.AuditService.logEvent({
        runId: run.id,
        eventType: 'RUN_STARTED',
        actorId: req.user?.id,
        actorName: req.user?.name,
        fromState: prevStatus,
        toState: 'running',
        payload: { speedMultiplier: run.speedMultiplier }
    });
    socketHandler_1.SocketHandler.broadcastRunStatusChanged(run.id, { runId: run.id, status: 'running' });
    // Instruct simulator service to start generation
    try {
        const devCount = store_1.db.runDevices.get(run.id)?.length || 200;
        await axios_1.default.post(`${env_1.ENV.SIMULATOR_URL}/simulator/start`, {
            runId: run.id,
            deviceCount: devCount,
            anomalyRate: run.anomalyInjectionConfig?.anomalyRate || 0.05,
            speedMultiplier: run.speedMultiplier,
            backendUrl: `http://localhost:${env_1.ENV.PORT}/api/ingest/telemetry`
        }, { timeout: 2000 });
    }
    catch (e) {
        // Simulator might be running locally or externally
    }
    res.json({ status: 'running', run });
});
exports.runsRouter.post('/runs/:id/pause', auth_1.authenticateToken, async (req, res) => {
    const run = store_1.db.runs.get(req.params.id);
    if (!run)
        return res.status(404).json({ error: 'Run not found' });
    const newStatus = run.status === 'paused' ? 'running' : 'paused';
    const prevStatus = run.status;
    run.status = newStatus;
    audit_service_1.AuditService.logEvent({
        runId: run.id,
        eventType: newStatus === 'paused' ? 'RUN_PAUSED' : 'RUN_RESUMED',
        actorId: req.user?.id,
        actorName: req.user?.name,
        fromState: prevStatus,
        toState: newStatus
    });
    socketHandler_1.SocketHandler.broadcastRunStatusChanged(run.id, { runId: run.id, status: newStatus });
    try {
        await axios_1.default.post(`${env_1.ENV.SIMULATOR_URL}/simulator/pause`, {}, { timeout: 1000 });
    }
    catch (e) { }
    res.json({ status: newStatus, run });
});
exports.runsRouter.post('/runs/:id/complete', auth_1.authenticateToken, async (req, res) => {
    const run = store_1.db.runs.get(req.params.id);
    if (!run)
        return res.status(404).json({ error: 'Run not found' });
    const prevStatus = run.status;
    run.status = 'completed';
    run.endedAt = new Date().toISOString();
    audit_service_1.AuditService.logEvent({
        runId: run.id,
        eventType: 'RUN_COMPLETED',
        actorId: req.user?.id,
        actorName: req.user?.name,
        fromState: prevStatus,
        toState: 'completed',
        payload: { elapsedHours: run.elapsedHours }
    });
    socketHandler_1.SocketHandler.broadcastRunStatusChanged(run.id, { runId: run.id, status: 'completed' });
    try {
        await axios_1.default.post(`${env_1.ENV.SIMULATOR_URL}/simulator/stop`, {}, { timeout: 1000 });
    }
    catch (e) { }
    res.json({ status: 'completed', run });
});
// --------------------------------------------------------------------------
// Audit Trail & Verification
// --------------------------------------------------------------------------
exports.runsRouter.get('/runs/:id/audit', auth_1.authenticateToken, (req, res) => {
    const logs = audit_service_1.AuditService.getRunLogs(req.params.id);
    res.json(logs);
});
exports.runsRouter.get('/runs/:id/audit/verify', auth_1.authenticateToken, (req, res) => {
    const result = audit_service_1.AuditService.verifyRunChain(req.params.id);
    res.json(result);
});
