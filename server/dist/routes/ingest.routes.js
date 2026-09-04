"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestRouter = void 0;
const express_1 = require("express");
const telemetry_service_1 = require("../services/telemetry.service");
exports.ingestRouter = (0, express_1.Router)();
exports.ingestRouter.post('/ingest/telemetry', async (req, res) => {
    const { runId, elapsedHours, samples } = req.body;
    if (!runId || !Array.isArray(samples)) {
        return res.status(400).json({ error: 'runId and samples array are required' });
    }
    try {
        const result = await telemetry_service_1.TelemetryService.ingestBatch(runId, elapsedHours || 0.0, samples);
        res.json({ status: 'ingested', ...result });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to ingest telemetry batch', detail: err.message });
    }
});
