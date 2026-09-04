"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const store_1 = require("../database/store");
const ml_service_1 = require("./ml.service");
const socketHandler_1 = require("../socket/socketHandler");
const uuid_1 = require("uuid");
class TelemetryService {
    /**
     * Ingests a high-frequency tick batch of telemetry from simulator or DAQ
     */
    static async ingestBatch(runId, elapsedHours, samples) {
        const run = store_1.db.runs.get(runId);
        if (run) {
            run.elapsedHours = elapsedHours;
            if (run.status === 'created') {
                run.status = 'running';
                run.startedAt = run.startedAt || new Date().toISOString();
                socketHandler_1.SocketHandler.broadcastRunStatusChanged(runId, { runId, status: 'running' });
            }
        }
        // 1. Calculate cohort statistics for this tick
        let sumLeakage = 0;
        for (const s of samples) {
            sumLeakage += s.readings.leakageCurrent;
            store_1.db.addTelemetrySample(s);
        }
        const leakageMean = sumLeakage / (samples.length || 1);
        let sumVariance = 0;
        for (const s of samples) {
            sumVariance += Math.pow(s.readings.leakageCurrent - leakageMean, 2);
        }
        const leakageStd = Math.sqrt(sumVariance / (samples.length || 1));
        const cohortStats = { leakageMean, leakageStd };
        // 2. Score batch with multi-model ensemble
        const scoresMap = await ml_service_1.MLService.scoreBatch(runId, samples, store_1.db.telemetryHistory, cohortStats);
        // 3. Process scores, detect alerts, and update devices
        const deviceSnapshots = [];
        for (const s of samples) {
            const scores = scoresMap.get(s.deviceId) || {
                pointScore: 0.1,
                driftScore: 0.1,
                sequenceScore: 0.1,
                ensembleScore: 5.0,
                severity: 'nominal'
            };
            const devKey = `${runId}:${s.deviceId}`;
            const dev = store_1.db.devices.get(devKey);
            if (dev) {
                dev.latestScores = scores;
                dev.latestReadings = s.readings;
            }
            deviceSnapshots.push({
                deviceId: s.deviceId,
                channelId: s.channelId,
                readings: s.readings,
                scores
            });
            // 4. If critical or warning anomaly threshold crossed, generate explainable alert
            if (scores.ensembleScore >= 40.0) {
                // Prevent duplicate spamming alerts if one was raised recently for this device
                const existingAlert = Array.from(store_1.db.alerts.values()).find(a => a.runId === runId && a.deviceId === s.deviceId && !a.acknowledgedAt);
                if (!existingAlert || scores.ensembleScore > existingAlert.score + 10) {
                    const explanation = await ml_service_1.MLService.getExplanation({
                        runId,
                        deviceId: s.deviceId,
                        channelId: s.channelId || 1,
                        readings: s.readings,
                        history: (store_1.db.telemetryHistory.get(devKey) || []).slice(-15),
                        scores,
                        cohortStats
                    });
                    const alert = {
                        id: (0, uuid_1.v4)(),
                        runId,
                        deviceId: s.deviceId,
                        deviceSerial: dev?.deviceSerial || `HMC-2026-${s.deviceId}`,
                        channelId: s.channelId,
                        score: scores.ensembleScore,
                        severity: scores.severity === 'critical' ? 'critical' : 'warning',
                        message: explanation.summary,
                        explanation,
                        createdAt: new Date().toISOString()
                    };
                    store_1.db.alerts.set(alert.id, alert);
                    // Emit real-time alert to UI conforming to Appendix C
                    socketHandler_1.SocketHandler.broadcastAnomalyFlagged(runId, {
                        runId,
                        deviceId: s.deviceId,
                        deviceSerial: alert.deviceSerial,
                        timestamp: s.time,
                        scores,
                        severity: alert.severity,
                        anomalyClassGuess: scores.anomalyClassGuess,
                        explanation: alert.explanation,
                        alertId: alert.id
                    });
                }
            }
        }
        // 5. Broadcast live telemetry tick to room
        socketHandler_1.SocketHandler.broadcastTelemetryTick(runId, {
            runId,
            elapsedHours,
            cohortStats,
            timestamp: samples[0]?.time || new Date().toISOString(),
            devices: deviceSnapshots
        });
        return { processed: samples.length, elapsedHours };
    }
}
exports.TelemetryService = TelemetryService;
