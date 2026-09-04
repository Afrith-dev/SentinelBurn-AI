"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const report_service_1 = require("../services/report.service");
exports.reportsRouter = (0, express_1.Router)();
exports.reportsRouter.get('/runs/:id/report', auth_1.authenticateToken, (req, res) => {
    try {
        const reportData = report_service_1.ReportService.generateLotReport(req.params.id);
        res.json(reportData);
    }
    catch (err) {
        res.status(404).json({ error: err.message });
    }
});
exports.reportsRouter.get('/runs/:id/report/html', (req, res) => {
    try {
        const reportData = report_service_1.ReportService.generateLotReport(req.params.id);
        res.setHeader('Content-Type', 'text/html');
        res.send(reportData.htmlReport);
    }
    catch (err) {
        res.status(404).send(`<h1>Error generating report: ${err.message}</h1>`);
    }
});
