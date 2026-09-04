"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotService = void 0;
const store_1 = require("../database/store");
const audit_service_1 = require("./audit.service");
const ml_service_1 = require("./ml.service");
const uuid_1 = require("uuid");
class CopilotService {
    /**
     * Normalizes spoken DUT numbers e.g. "DUT 104", "DUT-104", "DUT104", "channel 14" -> "d-0104"
     */
    static extractDeviceId(text) {
        // Check for d-0042 directly
        const directMatch = text.match(/\bd-?(\d{1,4})\b/i);
        if (directMatch) {
            const num = parseInt(directMatch[1], 10);
            return `d-${String(num).padStart(4, '0')}`;
        }
        // Check for "dut 104", "dut-104", "channel 104", "device 104"
        const phrasedMatch = text.match(/\b(?:dut|device|channel|component)\s*[-#]?\s*(\d{1,4})\b/i);
        if (phrasedMatch) {
            const num = parseInt(phrasedMatch[1], 10);
            return `d-${String(num).padStart(4, '0')}`;
        }
        return null;
    }
    /**
     * Main intent router and natural language domain processor
     */
    static async processQuery(req) {
        const rawQuery = (req.query || '').trim();
        const query = rawQuery.toLowerCase();
        const activeRunId = req.runId || (Array.from(store_1.db.runs.keys())[0] || 'run-isro-live-001');
        const userRole = req.userRole || 'reliability_engineer';
        const userName = req.userName || 'Engineer';
        // ------------------------------------------------------------------------
        // 0. Safety-Critical Confirmation Flow
        // ------------------------------------------------------------------------
        if (req.pendingConfirmation) {
            const isAffirmative = /^(yes|confirm|proceed|affirmative|do it|execute|accept|approve)\b/i.test(query) ||
                query.includes('confirm') || query.includes('yes');
            const isNegative = /^(no|cancel|abort|stop|negative|nevermind|don't)\b/i.test(query) ||
                query.includes('cancel') || query.includes('no');
            if (isAffirmative) {
                // Execute the pending action
                const { runId, deviceId, decision } = req.pendingConfirmation;
                const devKey = `${runId}:${deviceId}`;
                const dev = store_1.db.devices.get(devKey);
                if (!dev) {
                    return {
                        intent: 'CONFIRMATION_FAILED',
                        message: `Execution failed: Device ${deviceId} not found for run ${runId}.`,
                        spokenText: `Device ${deviceId} was not found.`
                    };
                }
                const disposition = {
                    id: (0, uuid_1.v4)(),
                    deviceId,
                    runId,
                    engineerId: 'u-copilot',
                    engineerName: `${userName} (via Voice Copilot)`,
                    decision,
                    comment: `Voice-authorized disposition: ${decision.toUpperCase()} on ${deviceId}`,
                    decidedAt: new Date().toISOString()
                };
                store_1.db.dispositions.set(deviceId, disposition);
                // Record into SHA-256 Audit Trail
                audit_service_1.AuditService.logEvent({
                    runId,
                    eventType: 'VOICE_ENGINEER_DISPOSITION',
                    actorName: `${userName} (Voice Copilot)`,
                    fromState: 'FLAGGED_ANOMALY',
                    toState: decision.toUpperCase(),
                    payload: {
                        deviceId,
                        decision,
                        voiceCommand: rawQuery
                    }
                });
                const decisionDisplay = decision === 'hold_fa' ? 'HOLD FOR FAILURE ANALYSIS' : decision.toUpperCase();
                return {
                    intent: 'DISPOSITION_EXECUTED',
                    message: `Confirmed: DUT ${deviceId.replace('d-', '')} is now marked as [${decisionDisplay}]. The decision has been cryptographically signed into the SHA-256 flight audit ledger.`,
                    spokenText: `Confirmed. Device ${deviceId.replace('d-', '')} has been placed on ${decisionDisplay}, and recorded in the audit trail.`,
                    navigationUrl: `/runs/${runId}/devices/${deviceId}`,
                    data: { disposition }
                };
            }
            else if (isNegative) {
                return {
                    intent: 'CONFIRMATION_CANCELLED',
                    message: `Action cancelled. No disposition was recorded for device ${req.pendingConfirmation.deviceId}.`,
                    spokenText: `Action cancelled. No changes were made.`
                };
            }
        }
        // ------------------------------------------------------------------------
        // 1. Action: Put on Hold / Reject / Accept Device
        // ------------------------------------------------------------------------
        if (query.includes('hold') || query.includes('reject') || query.includes('accept')) {
            const targetDevId = this.extractDeviceId(query);
            if (!targetDevId) {
                return {
                    intent: 'ACTION_NEEDS_TARGET',
                    message: 'Please specify which DUT you would like to disposition (for example: "Put DUT-104 on hold for failure analysis" or "Reject DUT-104").',
                    spokenText: 'Which device would you like to disposition? For example, DUT-104.'
                };
            }
            let decision = 'hold_fa';
            if (query.includes('reject'))
                decision = 'reject';
            else if (query.includes('accept'))
                decision = 'accept';
            else if (query.includes('hold'))
                decision = 'hold_fa';
            // RBAC Validation
            if (userRole === 'operator') {
                return {
                    intent: 'RBAC_DENIED',
                    message: `Access Denied: Floor Operators cannot execute component dispositions. This action requires a Reliability Lead, QA Director, or FA Engineer per ISRO-PAS-206.`,
                    spokenText: `Access denied. Operators cannot execute device dispositions. Please escalate to a Reliability Engineer.`
                };
            }
            // Check device details
            const devKey = `${activeRunId}:${targetDevId}`;
            const dev = store_1.db.devices.get(devKey);
            const score = dev?.latestScores?.ensembleScore || 0;
            const signature = dev?.latestScores?.anomalyClassGuess || 'parametric deviation';
            const decisionName = decision === 'hold_fa' ? 'HOLD FOR FAILURE ANALYSIS' : decision.toUpperCase();
            const promptText = `DUT ${targetDevId.replace('d-', '')} has an Anomaly Confidence Score of ${score}% with ${signature.replace('_', ' ')}. Placing this component on ${decisionName} will be immutably recorded in the SHA-256 audit ledger. Do you want to confirm?`;
            return {
                intent: 'ACTION_CONFIRMATION_REQUIRED',
                message: promptText,
                spokenText: promptText,
                requiresConfirmation: true,
                navigationUrl: `/runs/${activeRunId}/devices/${targetDevId}`,
                confirmationPayload: {
                    action: 'DISPOSITION',
                    runId: activeRunId,
                    deviceId: targetDevId,
                    decision
                }
            };
        }
        // ------------------------------------------------------------------------
        // 2. Query: "Why was DUT-X flagged?" / "Explain DUT-X" / Anomaly Score
        // ------------------------------------------------------------------------
        const targetDevId = this.extractDeviceId(query);
        if (targetDevId && (query.includes('why') || query.includes('flag') || query.includes('score') || query.includes('explain') || query.includes('status') || query.includes('alert') || query.includes('cause'))) {
            const devKey = `${activeRunId}:${targetDevId}`;
            const dev = store_1.db.devices.get(devKey);
            if (!dev) {
                return {
                    intent: 'DEVICE_NOT_FOUND',
                    message: `Device ${targetDevId} not found in active run ${activeRunId}.`,
                    spokenText: `Device ${targetDevId} was not found.`
                };
            }
            const score = dev.latestScores?.ensembleScore || 0;
            const severity = dev.latestScores?.severity || 'nominal';
            const anomalyClass = dev.latestScores?.anomalyClassGuess || 'healthy';
            const leakage = dev.latestReadings?.leakageCurrent ? (dev.latestReadings.leakageCurrent * 1000).toFixed(2) : '2.50';
            // Request SHAP explanation
            const history = store_1.db.getTelemetryHistory(activeRunId, targetDevId);
            let explanationSummary = '';
            try {
                const explainData = await ml_service_1.MLService.getExplanation({
                    runId: activeRunId,
                    deviceId: targetDevId,
                    channelId: dev.channelId,
                    readings: dev.latestReadings || { voltage: 5.0, current: 0.18, leakageCurrent: 0.0025, temperature: 125.0 },
                    history: history.slice(-20),
                    scores: dev.latestScores || { ensembleScore: score, anomalyClassGuess: anomalyClass }
                });
                explanationSummary = explainData.summary || '';
            }
            catch (err) {
                explanationSummary = `Leakage current measured at ${leakage} µA, showing deviation from the lot mean.`;
            }
            const displayMessage = `DUT ${targetDevId.replace('d-', '')} (Serial ${dev.deviceSerial}) is flagged with an Anomaly Confidence Score of ${score}% [${severity.toUpperCase()}].\n\nAI Diagnosis (${anomalyClass.replace('_', ' ').toUpperCase()}):\n${explanationSummary}`;
            const spoken = `DUT ${targetDevId.replace('d-', '')} was flagged with an anomaly confidence score of ${Math.round(score)} percent. Primary signature is ${anomalyClass.replace('_', ' ')}. ${explanationSummary}`;
            return {
                intent: 'DEVICE_EXPLANATION',
                message: displayMessage,
                spokenText: spoken,
                navigationUrl: `/runs/${activeRunId}/devices/${targetDevId}`,
                data: {
                    deviceId: targetDevId,
                    score,
                    severity,
                    anomalyClass,
                    latestReadings: dev.latestReadings
                }
            };
        }
        // ------------------------------------------------------------------------
        // 3. Query: "Compare DUT-X with cohort" / "Cohort comparison"
        // ------------------------------------------------------------------------
        if (targetDevId && (query.includes('compare') || query.includes('cohort') || query.includes('lot average'))) {
            const devKey = `${activeRunId}:${targetDevId}`;
            const dev = store_1.db.devices.get(devKey);
            const devLeakage = dev?.latestReadings?.leakageCurrent ? (dev.latestReadings.leakageCurrent * 1000) : 2.5;
            // Compute cohort average
            const deviceIds = store_1.db.runDevices.get(activeRunId) || [];
            let totalLeakage = 0;
            let count = 0;
            for (const dId of deviceIds) {
                const d = store_1.db.devices.get(`${activeRunId}:${dId}`);
                if (d?.latestReadings?.leakageCurrent) {
                    totalLeakage += d.latestReadings.leakageCurrent * 1000;
                    count++;
                }
            }
            const cohortAvg = count > 0 ? (totalLeakage / count) : 2.50;
            const deltaPercent = (((devLeakage - cohortAvg) / cohortAvg) * 100).toFixed(1);
            const message = `Cohort Analysis for DUT ${targetDevId.replace('d-', '')}:\n• DUT Leakage Current: ${devLeakage.toFixed(2)} µA\n• Lot Cohort Mean: ${cohortAvg.toFixed(2)} µA\n• Relative Deviation: ${deltaPercent}% vs Lot Envelope.`;
            const spoken = `DUT ${targetDevId.replace('d-', '')} has a leakage current of ${devLeakage.toFixed(2)} micro-amps, which is ${Math.abs(Number(deltaPercent))} percent ${Number(deltaPercent) > 0 ? 'above' : 'below'} the lot average of ${cohortAvg.toFixed(2)} micro-amps.`;
            return {
                intent: 'COHORT_COMPARISON',
                message,
                spokenText: spoken,
                navigationUrl: `/runs/${activeRunId}/devices/${targetDevId}`,
                data: {
                    targetLeakage: devLeakage,
                    cohortAvg,
                    deltaPercent
                }
            };
        }
        // ------------------------------------------------------------------------
        // 4. Query: "Show critical devices" / "Which devices are anomalous?"
        // ------------------------------------------------------------------------
        if (query.includes('critical') || query.includes('anomal') || query.includes('warning') || query.includes('flagged') || query.includes('failing')) {
            const deviceIds = store_1.db.runDevices.get(activeRunId) || [];
            const criticals = [];
            const warnings = [];
            for (const dId of deviceIds) {
                const dev = store_1.db.devices.get(`${activeRunId}:${dId}`);
                const score = dev?.latestScores?.ensembleScore || 0;
                const type = dev?.latestScores?.anomalyClassGuess || 'anomaly';
                if (score >= 65.0)
                    criticals.push({ id: dId, score, type });
                else if (score >= 40.0)
                    warnings.push({ id: dId, score, type });
            }
            if (criticals.length === 0 && warnings.length === 0) {
                return {
                    intent: 'ANOMALIES_LIST_EMPTY',
                    message: `Chamber Surveillance Status: All 200 DUTs in run ${activeRunId} are operating within nominal health bounds (Scores < 40%).`,
                    spokenText: `All monitored components are currently nominal. No critical devices detected.`
                };
            }
            const critText = criticals.map(c => `DUT ${c.id.replace('d-', '')} (${c.score}%, ${c.type.replace('_', ' ')})`).join(', ');
            const warnText = warnings.map(w => `DUT ${w.id.replace('d-', '')} (${w.score}%)`).join(', ');
            let msg = `Burn-In Chamber Surveillance Summary:\n• Critical Devices (${criticals.length}): ${critText || 'None'}\n• Warning Devices (${warnings.length}): ${warnText || 'None'}`;
            let spoken = criticals.length > 0
                ? `There are ${criticals.length} critical devices. ${critText}.`
                : `There are ${warnings.length} devices showing early warning signs.`;
            return {
                intent: 'ANOMALIES_LIST',
                message: msg,
                spokenText: spoken,
                navigationUrl: `/runs/${activeRunId}`,
                data: { criticals, warnings }
            };
        }
        // ------------------------------------------------------------------------
        // 5. Query: "Show active runs" / "Run status"
        // ------------------------------------------------------------------------
        if (query.includes('run') && (query.includes('active') || query.includes('list') || query.includes('status') || query.includes('show'))) {
            const runs = Array.from(store_1.db.runs.values());
            const activeRuns = runs.filter(r => r.status === 'running');
            if (activeRuns.length === 0) {
                return {
                    intent: 'RUNS_LIST',
                    message: `There are currently 0 active burn-in runs. Total registered runs: ${runs.length}.`,
                    spokenText: `There are currently no active burn-in runs.`,
                    navigationUrl: `/dashboard`
                };
            }
            const activeList = activeRuns.map(r => `${r.id} (Lot ${r.lotId}, ${r.elapsedHours.toFixed(1)}h elapsed)`).join('\n');
            const spoken = `There is ${activeRuns.length} active burn-in run: ${activeRuns[0].id}, elapsed time ${activeRuns[0].elapsedHours.toFixed(1)} hours.`;
            return {
                intent: 'RUNS_LIST',
                message: `Active Burn-In Runs (${activeRuns.length}):\n${activeList}`,
                spokenText: spoken,
                navigationUrl: `/runs/${activeRuns[0].id}`,
                data: { activeRuns }
            };
        }
        // ------------------------------------------------------------------------
        // 6. Query: "Show latest alerts" / "Alerts"
        // ------------------------------------------------------------------------
        if (query.includes('alert') || query.includes('alarms')) {
            const alerts = Array.from(store_1.db.alerts.values()).filter(a => a.runId === activeRunId).slice(-5);
            if (alerts.length === 0) {
                return {
                    intent: 'ALERTS_LIST_EMPTY',
                    message: `No recent anomaly alerts recorded for run ${activeRunId}.`,
                    spokenText: `There are no unacknowledged alerts.`
                };
            }
            const alertList = alerts.map(a => `• [${a.severity.toUpperCase()}] DUT ${a.deviceId.replace('d-', '')}: ${a.message.slice(0, 90)}...`).join('\n');
            const spoken = `There are ${alerts.length} recent alerts. Most recent: DUT ${alerts[alerts.length - 1].deviceId.replace('d-', '')} flagged as ${alerts[alerts.length - 1].severity}.`;
            return {
                intent: 'ALERTS_LIST',
                message: `Recent Anomaly Alerts:\n${alertList}`,
                spokenText: spoken,
                navigationUrl: `/runs/${activeRunId}`,
                data: { alerts }
            };
        }
        // ------------------------------------------------------------------------
        // 7. Action: "Generate Lot Report" / "Show Report"
        // ------------------------------------------------------------------------
        if (query.includes('report') || query.includes('pdf') || query.includes('certificate')) {
            return {
                intent: 'NAVIGATE_REPORT',
                message: `Navigating to the Official Lot Disposition & Qualification Report for Run ${activeRunId}. The cryptographic SHA-256 chain will be validated.`,
                spokenText: `Opening the official lot qualification report with cryptographic audit seal.`,
                navigationUrl: `/reports`
            };
        }
        // ------------------------------------------------------------------------
        // 8. Navigation Shortcuts
        // ------------------------------------------------------------------------
        if (query.includes('dashboard') || query.includes('console')) {
            return {
                intent: 'NAVIGATE',
                message: 'Opening Operations Mission Console.',
                spokenText: 'Navigating to mission console.',
                navigationUrl: '/dashboard'
            };
        }
        if (query.includes('models') || query.includes('metrics') || query.includes('shap')) {
            return {
                intent: 'NAVIGATE',
                message: 'Opening AI Ensemble & SHAP Performance Evaluation Dashboard.',
                spokenText: 'Navigating to model performance metrics.',
                navigationUrl: '/models'
            };
        }
        // ------------------------------------------------------------------------
        // Default Fallback
        // ------------------------------------------------------------------------
        return {
            intent: 'UNKNOWN_QUERY',
            message: `SentinelBurn Voice Copilot here. You can ask me:\n• "Why was DUT-104 flagged?"\n• "Which devices are anomalous?"\n• "Compare DUT-104 with the cohort"\n• "Put DUT-104 on hold for failure analysis"\n• "Show active runs" or "Generate the lot report"`,
            spokenText: `I am your Voice Reliability Copilot. You can ask about anomalous devices, SHAP explanations, or issue voice dispositions.`
        };
    }
}
exports.CopilotService = CopilotService;
