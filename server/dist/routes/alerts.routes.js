"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertsRouter = void 0;
const express_1 = require("express");
const store_1 = require("../database/store");
const auth_1 = require("../middleware/auth");
exports.alertsRouter = (0, express_1.Router)();
exports.alertsRouter.get('/runs/:id/alerts', auth_1.authenticateToken, (req, res) => {
    const runId = req.params.id;
    const runAlerts = Array.from(store_1.db.alerts.values())
        .filter(a => a.runId === runId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(runAlerts);
});
exports.alertsRouter.post('/alerts/:id/acknowledge', auth_1.authenticateToken, (req, res) => {
    const alert = store_1.db.alerts.get(req.params.id);
    if (!alert)
        return res.status(404).json({ error: 'Alert not found' });
    alert.acknowledgedBy = req.user?.name || 'Engineer';
    alert.acknowledgedAt = new Date().toISOString();
    res.json({ status: 'acknowledged', alert });
});
