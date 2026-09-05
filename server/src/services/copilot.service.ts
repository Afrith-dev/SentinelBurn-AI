import { db } from '../database/store';
import { AuditService } from './audit.service';
import { MLService } from './ml.service';
import { UserRole, Disposition } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { ActionService, PendingAction } from './action.service';
import { AnalysisService } from './analysis.service';

export interface CopilotQueryRequest {
  query: string;
  runId?: string;
  userRole?: UserRole;
  userName?: string;
  userId?: string;
  sessionId?: string;
  pendingActionId?: string;
}

export interface CopilotResponse {
  intent: string;
  message: string;
  spokenText: string;
  navigationUrl?: string;
  requiresConfirmation?: boolean;
  confirmationPayload?: PendingAction;
  actionResult?: any;
  data?: any;
}

export class CopilotService {
  /**
   * Normalizes spoken DUT numbers e.g. "DUT 104", "DUT-104", "DUT104", "channel 14" -> "d-0104"
   */
  static extractDeviceId(text: string): string | null {
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
  static async processQuery(req: CopilotQueryRequest): Promise<CopilotResponse> {
    const rawQuery = (req.query || '').trim();
    const query = rawQuery.toLowerCase();
    const activeRunId = req.runId || (Array.from(db.runs.keys())[0] || 'run-isro-live-001');
    const userRole = req.userRole || 'reliability_engineer';
    const userName = req.userName || 'Engineer';
    const userId = req.userId || 'u-rel-01';
    const sessionId = req.sessionId || userId;

    // ------------------------------------------------------------------------
    // 0. Safety-Critical Confirmation Flow
    // ------------------------------------------------------------------------
    if (req.pendingActionId) {
      if (ActionService.isAffirmative(rawQuery)) {
        const result = ActionService.confirm(req.pendingActionId, userId, sessionId, userRole, userName);
        return { intent: `ACTION_${result.status}`, message: result.message, spokenText: result.spokenText, navigationUrl: result.navigationUrl, data: result.data, actionResult: result };
      }
      if (ActionService.isNegative(rawQuery)) {
        const result = ActionService.cancel(req.pendingActionId, userId, sessionId);
        return { intent: 'ACTION_CANCELLED', message: result.message, spokenText: result.spokenText, actionResult: result };
      }
      return { intent: 'ACTION_CONFIRMATION_REQUIRED', message: 'Please confirm or cancel the pending action before starting another action.', spokenText: 'Please confirm or cancel the pending action first.', requiresConfirmation: true, confirmationPayload: ActionService.getPending(req.pendingActionId) };
    }

    const analysisRequest = /\b(analy[sz]e|what is happening|what are you seeing|summary|summarize|monitor|monitoring|current screen|current run|running session|burn-in run|burn in run|any anomalies|which dut is in trouble)\b/i.test(query);
    if (analysisRequest && !(query.includes('open') || query.includes('navigate') || query.includes('take me'))) {
      const analysis = await AnalysisService.analyzeRun(activeRunId);
      const run = analysis.run;
      const anomalies = analysis.anomalies;
      const critical = analysis.criticalDevices;
      const highest = analysis.highestRiskDevice;
      const statusText = run.available
        ? `Run ${run.runId} is ${run.status}, with ${run.reportingDevices}/${run.totalDevices} devices reporting telemetry (${run.reportingCoverage}% coverage).`
        : run.message;
      const anomalyText = anomalies.length
        ? `I found ${anomalies.length} devices at or above the warning threshold. ${critical.length ? `${critical.length} are critical.` : 'None currently meet the critical threshold.'}`
        : 'No elevated anomaly scores are currently available from the backend.';
      const highestText = highest?.deviceId
        ? `Highest current risk is ${highest.deviceId} at ${highest.scores?.ensembleScore ?? 'unavailable'} with ${highest.scores?.anomalyClassGuess || 'unknown'} classification.`
        : '';
      const trendText = analysis.trends.samples
        ? `Across ${analysis.trends.samples} current device snapshots, temperature ranged from ${analysis.trends.min?.temperature ?? 'unavailable'} to ${analysis.trends.max?.temperature ?? 'unavailable'}, and leakage ranged from ${analysis.trends.min?.leakageCurrent ?? 'unavailable'} to ${analysis.trends.max?.leakageCurrent ?? 'unavailable'} mA.`
        : 'No live telemetry samples are available for trend analysis.';
      const recommendation = analysis.recommendation;
      return {
        intent: 'RUN_ANALYSIS',
        message: `${statusText}\n\n${anomalyText} ${highestText}\n\n${trendText}\n\nEngineering recommendation: ${recommendation}`,
        spokenText: `${statusText} ${anomalyText} ${highestText} Engineering recommendation: ${recommendation}`,
        data: { ...analysis, monitoringRequested: /\bmonitor|monitoring\b/i.test(query) }
      };
    }

    let actionDeviceId = ActionService.resolveDeviceReference(query, sessionId) || this.extractDeviceId(query) || undefined;
    if (!actionDeviceId && query.includes('most critical')) {
      const deviceIds = db.runDevices.get(activeRunId) || [];
      actionDeviceId = deviceIds
        .map((deviceId) => ({ deviceId, score: db.devices.get(`${activeRunId}:${deviceId}`)?.latestScores?.ensembleScore || 0 }))
        .sort((a, b) => b.score - a.score)[0]?.deviceId;
    }
    const isOpenRequest = /\b(open|show me|take me to|navigate|display)\b/i.test(query);
    const isFetchRequest = /\b(fetch|get detailed|retrieve|load)\b/i.test(query);
    if (isOpenRequest || isFetchRequest) {
      let action = 'OPEN_DEVICE';
      if (query.includes('alert')) action = 'OPEN_ALERTS';
      else if ((query.includes('critical') || query.includes('anomal')) && !actionDeviceId) action = 'OPEN_CRITICAL_DEVICES';
      else if (query.includes('report') || query.includes('qualification')) action = 'OPEN_REPORT';
      else if (query.includes('run') && !actionDeviceId) action = 'OPEN_RUN';
      else if (query.includes('telemetry')) action = isFetchRequest ? 'FETCH_TELEMETRY' : 'OPEN_TELEMETRY';
      else if (query.includes('shap')) action = 'OPEN_SHAP';
      else if (query.includes('anomaly') || query.includes('explanation')) action = 'OPEN_ANOMALY';
      else if (isFetchRequest) action = 'FETCH_DEVICE_DETAILS';

      const args = { runId: activeRunId, deviceId: actionDeviceId };
      if (['OPEN_DEVICE', 'OPEN_TELEMETRY', 'OPEN_ANOMALY', 'OPEN_SHAP', 'FETCH_DEVICE_DETAILS', 'FETCH_TELEMETRY'].includes(action) && !actionDeviceId) {
        return { intent: 'ACTION_NEEDS_TARGET', message: 'Which device should I open or fetch?', spokenText: 'Which device should I open or fetch?' };
      }
      const pending = ActionService.createPending({ action, args, userId, sessionId });
      if ('error' in pending) return { intent: 'ACTION_FAILED', message: pending.error, spokenText: pending.error };
      return { intent: 'ACTION_CONFIRMATION_REQUIRED', message: `${pending.description} Would you like me to proceed?`, spokenText: `${pending.description} Would you like me to proceed?`, requiresConfirmation: true, confirmationPayload: pending };
    }

    // ------------------------------------------------------------------------
    // 1. Action: Put on Hold / Reject / Accept Device
    // ------------------------------------------------------------------------
    if (query.includes('hold') || query.includes('reject') || query.includes('accept') || query.includes('failed') || query.includes('passed') || query.includes('quarantine')) {
      const targetDevId = this.extractDeviceId(query);
      if (!targetDevId) {
        return {
          intent: 'ACTION_NEEDS_TARGET',
          message: 'Please specify which DUT you would like to disposition (for example: "Put DUT-104 on hold for failure analysis" or "Reject DUT-104").',
          spokenText: 'Which device would you like to disposition? For example, DUT-104.'
        };
      }

      let decision: 'accept' | 'reject' | 'hold_fa' = 'hold_fa';
      if (query.includes('reject') || query.includes('failed')) decision = 'reject';
      else if (query.includes('accept') || query.includes('passed')) decision = 'accept';
      else if (query.includes('hold')) decision = 'hold_fa';

      // Check device details
      const devKey = `${activeRunId}:${targetDevId}`;
      const dev = db.devices.get(devKey);
      const score = dev?.latestScores?.ensembleScore || 0;
      const signature = dev?.latestScores?.anomalyClassGuess || 'parametric deviation';

      const decisionName = decision === 'hold_fa' ? 'HOLD FOR FAILURE ANALYSIS' : decision.toUpperCase();
      const promptText = `DUT ${targetDevId.replace('d-', '')} has an Anomaly Confidence Score of ${score}% with ${signature.replace('_', ' ')}. Placing this component on ${decisionName} will be immutably recorded in the SHA-256 audit ledger. Do you want to confirm?`;

      const pending = ActionService.createPending({ action: 'DISPOSITION', args: { runId: activeRunId, deviceId: targetDevId, decision }, userId, sessionId, userRole, userName });
      if ('error' in pending) return { intent: 'ACTION_FAILED', message: pending.error, spokenText: pending.error };
      return {
        intent: 'ACTION_CONFIRMATION_REQUIRED',
        message: promptText,
        spokenText: promptText,
        requiresConfirmation: true,
        confirmationPayload: pending
      };
    }

    // ------------------------------------------------------------------------
    // 2. Query: "Why was DUT-X flagged?" / "Explain DUT-X" / Anomaly Score
    // ------------------------------------------------------------------------
    const targetDevId = this.extractDeviceId(query);
    if (targetDevId && (query.includes('why') || query.includes('flag') || query.includes('score') || query.includes('explain') || query.includes('status') || query.includes('alert') || query.includes('cause'))) {
      const devKey = `${activeRunId}:${targetDevId}`;
      const dev = db.devices.get(devKey);

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
      const history = db.getTelemetryHistory(activeRunId, targetDevId);
      let explanationSummary = '';
      try {
        const explainData = await MLService.getExplanation({
          runId: activeRunId,
          deviceId: targetDevId,
          channelId: dev.channelId,
          readings: dev.latestReadings || { voltage: 5.0, current: 0.18, leakageCurrent: 0.0025, temperature: 125.0 },
          history: history.slice(-20),
          scores: dev.latestScores || { ensembleScore: score, anomalyClassGuess: anomalyClass }
        });
        explanationSummary = explainData.summary || '';
      } catch (err) {
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
      const dev = db.devices.get(devKey);
      const devLeakage = dev?.latestReadings?.leakageCurrent ? (dev.latestReadings.leakageCurrent * 1000) : 2.5;

      // Compute cohort average
      const deviceIds = db.runDevices.get(activeRunId) || [];
      let totalLeakage = 0;
      let count = 0;
      for (const dId of deviceIds) {
        const d = db.devices.get(`${activeRunId}:${dId}`);
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
      const deviceIds = db.runDevices.get(activeRunId) || [];
      const criticals: Array<{ id: string; score: number; type: string }> = [];
      const warnings: Array<{ id: string; score: number; type: string }> = [];

      for (const dId of deviceIds) {
        const dev = db.devices.get(`${activeRunId}:${dId}`);
        const score = dev?.latestScores?.ensembleScore || 0;
        const type = dev?.latestScores?.anomalyClassGuess || 'anomaly';
        if (score >= 65.0) criticals.push({ id: dId, score, type });
        else if (score >= 40.0) warnings.push({ id: dId, score, type });
      }

      if (criticals.length === 0 && warnings.length === 0) {
        return {
          intent: 'ANOMALIES_LIST_EMPTY',
          message: `Chamber Surveillance Status: All 200 DUTs in run ${activeRunId} are operating within nominal health bounds (Scores < 40%).`,
          spokenText: `All monitored components are currently nominal. No critical devices detected.`
        };
      }

      ActionService.rememberResult(sessionId, activeRunId, [...criticals, ...warnings].map((item) => item.id));

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
      const runs = Array.from(db.runs.values());
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
      const alerts = Array.from(db.alerts.values()).filter(a => a.runId === activeRunId).slice(-5);
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
