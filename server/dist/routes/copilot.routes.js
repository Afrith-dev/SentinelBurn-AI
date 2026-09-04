"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copilotRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const copilot_service_1 = require("../services/copilot.service");
exports.copilotRouter = (0, express_1.Router)();
exports.copilotRouter.post('/copilot/query', auth_1.authenticateToken, async (req, res) => {
    try {
        const { query, runId, pendingConfirmation } = req.body;
        if (!query && !pendingConfirmation) {
            return res.status(400).json({ error: 'Query or pendingConfirmation required' });
        }
        const response = await copilot_service_1.CopilotService.processQuery({
            query: query || '',
            runId,
            userRole: req.user?.role,
            userName: req.user?.name,
            pendingConfirmation
        });
        res.json(response);
    }
    catch (err) {
        console.error('Copilot Query Error:', err);
        res.status(500).json({
            intent: 'ERROR',
            message: 'Failed to process voice copilot query: ' + (err.message || 'Internal error'),
            spokenText: 'Sorry, I encountered an error querying telemetry data.'
        });
    }
});
