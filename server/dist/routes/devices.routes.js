"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devicesRouter = void 0;
const express_1 = require("express");
const store_1 = require("../database/store");
const auth_1 = require("../middleware/auth");
const audit_service_1 = require("../services/audit.service");
const ml_service_1 = require("../services/ml.service");
const socketHandler_1 = require("../socket/socketHandler");
const uuid_1 = require("uuid");
exports.devicesRouter = (0, express_1.Router)();
exports.devicesRouter.get('/runs/:id/devices', auth_1.authenticateToken, (req, res) => {
    const runId = req.params.id;
    const deviceIds = store_1.db.runDevices.get(runId) || [];
    const devices = deviceIds.map(dId => {
        const dev = store_1.db.devices.get(`${runId}:${dId}`);
        if (!dev)
            return null;
        const disposition = store_1.db.dispositions.get(dev.id);
        return {
            ...dev,
            disposition
        };
    }).filter(Boolean);
    res.json(devices);
});
exports.devicesRouter.get('/runs/:id/devices/:deviceId', auth_1.authenticateToken, (req, res) => {
    const { id: runId, deviceId } = req.params;
    const dev = store_1.db.devices.get(`${runId}:${deviceId}`);
    if (!dev)
        return res.status(404).json({ error: 'Device not found' });
    const history = store_1.db.getTelemetryHistory(runId, deviceId);
    const disposition = store_1.db.dispositions.get(dev.id);
    res.json({
        ...dev,
        history,
        disposition
    });
});
exports.devicesRouter.get('/runs/:id/devices/:deviceId/telemetry', auth_1.authenticateToken, (req, res) => {
    const { id: runId, deviceId } = req.params;
    const history = store_1.db.getTelemetryHistory(runId, deviceId);
    res.json(history);
});
exports.devicesRouter.get('/runs/:id/devices/:deviceId/explain', auth_1.authenticateToken, async (req, res) => {
    const { id: runId, deviceId } = req.params;
    const dev = store_1.db.devices.get(`${runId}:${deviceId}`);
    if (!dev)
        return res.status(404).json({ error: 'Device not found' });
    const history = store_1.db.getTelemetryHistory(runId, deviceId);
    const latestReadings = dev.latestReadings || history[history.length - 1]?.readings || {
        voltage: 5.0,
        current: 0.18,
        leakageCurrent: 0.0025,
        temperature: 125.0
    };
    const scores = dev.latestScores || {
        pointScore: 0.5,
        driftScore: 0.8,
        sequenceScore: 0.6,
        ensembleScore: 78.0,
        severity: 'critical',
        anomalyClassGuess: 'gradual_drift'
    };
    const explanation = await ml_service_1.MLService.getExplanation({
        runId,
        deviceId,
        channelId: dev.channelId,
        readings: latestReadings,
        history: history.slice(-20),
        scores
    });
    res.json(explanation);
});
exports.devicesRouter.post('/devices/:id/disposition', auth_1.authenticateToken, (req, res) => {
    const deviceId = req.params.id;
    const { runId, decision, comment } = req.body;
    if (!runId || !decision) {
        return res.status(400).json({ error: 'runId and decision (accept|reject|hold_fa) are required' });
    }
    const devKey = `${runId}:${deviceId}`;
    const dev = store_1.db.devices.get(devKey);
    if (!dev) {
        return res.status(404).json({ error: 'Device not found for this run' });
    }
    const disposition = {
        id: (0, uuid_1.v4)(),
        deviceId,
        runId,
        decision,
        engineerId: req.user?.id || 'u-rel-01',
        engineerName: req.user?.name || 'Reliability Engineer',
        comment: comment || '',
        decidedAt: new Date().toISOString()
    };
    store_1.db.dispositions.set(deviceId, disposition);
    dev.disposition = disposition;
    // Append to cryptographic audit log
    audit_service_1.AuditService.logEvent({
        runId,
        eventType: `DEVICE_DISPOSITION_${decision.toUpperCase()}`,
        actorId: req.user?.id,
        actorName: req.user?.name,
        payload: {
            deviceId,
            deviceSerial: dev.deviceSerial,
            channelId: dev.channelId,
            decision,
            comment,
            anomalyScoreAtDisposition: dev.latestScores?.ensembleScore
        }
    });
    socketHandler_1.SocketHandler.broadcastDispositionCreated(runId, disposition);
    res.json({
        status: 'recorded',
        disposition
    });
});
