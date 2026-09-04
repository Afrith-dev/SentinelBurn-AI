"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const ml_service_1 = require("../services/ml.service");
exports.modelsRouter = (0, express_1.Router)();
exports.modelsRouter.get('/models', auth_1.authenticateToken, async (req, res) => {
    const metrics = await ml_service_1.MLService.getModelMetrics();
    res.json(metrics);
});
exports.modelsRouter.post('/models/retrain', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'qa_manager'), async (req, res) => {
    const result = await ml_service_1.MLService.triggerRetrain();
    res.json(result);
});
