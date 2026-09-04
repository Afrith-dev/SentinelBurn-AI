"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulatorRouter = void 0;
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const audit_service_1 = require("../services/audit.service");
exports.simulatorRouter = (0, express_1.Router)();
exports.simulatorRouter.get('/simulator/status', async (req, res) => {
    try {
        const response = await axios_1.default.get(`${env_1.ENV.SIMULATOR_URL}/simulator/status`, { timeout: 1500 });
        res.json(response.data);
    }
    catch (err) {
        res.json({
            status: 'simulator_offline',
            message: 'Simulator service is not running or unreachable',
            configuredUrl: env_1.ENV.SIMULATOR_URL
        });
    }
});
exports.simulatorRouter.post('/simulator/runs/:id/inject-anomaly', async (req, res) => {
    const { id: runId } = req.params;
    const { deviceId, anomalyClass, magnitude } = req.body;
    if (!deviceId || !anomalyClass) {
        return res.status(400).json({ error: 'deviceId and anomalyClass are required' });
    }
    // Audit log this intentional demonstration injection
    audit_service_1.AuditService.logEvent({
        runId,
        eventType: 'DEMO_ANOMALY_INJECTED',
        payload: { deviceId, anomalyClass, magnitude }
    });
    try {
        const response = await axios_1.default.post(`${env_1.ENV.SIMULATOR_URL}/simulator/inject`, {
            deviceId,
            anomalyClass,
            magnitude
        }, { timeout: 2000 });
        res.json(response.data);
    }
    catch (err) {
        res.status(500).json({
            error: 'Failed to communicate with telemetry simulator',
            detail: err.message
        });
    }
});
