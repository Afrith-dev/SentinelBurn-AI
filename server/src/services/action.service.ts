import { db } from '../database/store';
import { AuditService } from './audit.service';
import { UserRole, Disposition } from '../types';
import { v4 as uuidv4 } from 'uuid';

export type ActionCategory = 'READ' | 'UI_ACTION' | 'STATE_CHANGE';
export type ActionRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type PendingActionStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'EXECUTED' | 'FAILED';

export interface ActionArguments {
  runId?: string;
  deviceId?: string;
  decision?: 'accept' | 'reject' | 'hold_fa';
  reason?: string;
}

export interface PendingAction {
  actionId: string;
  userId: string;
  sessionId: string;
  action: string;
  category: ActionCategory;
  risk: ActionRisk;
  toolName: string;
  args: ActionArguments;
  description: string;
  createdAt: string;
  expiresAt: string;
  status: PendingActionStatus;
}

export interface ActionExecutionResult {
  actionId: string;
  status: 'EXECUTED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  message: string;
  spokenText: string;
  navigationUrl?: string;
  uiAction?: {
    type: 'UI_ACTION';
    action: string;
    target?: string;
    path: string;
  };
  data?: any;
}

interface ActionDefinition {
  category: ActionCategory;
  risk: ActionRisk;
  confirmationRequired: boolean;
  description: (args: ActionArguments) => string;
  execute: (pending: PendingAction, userRole?: UserRole, userName?: string) => ActionExecutionResult;
}

const normalizeDeviceId = (deviceId?: string) => {
  if (!deviceId) return undefined;
  const match = deviceId.match(/(?:d-|dut[- ]?)(\d{1,4})$/i) || deviceId.match(/^(\d{1,4})$/);
  return match ? `d-${String(Number(match[1])).padStart(4, '0')}` : deviceId.toLowerCase();
};

const devicePath = (runId: string, deviceId: string) => `/runs/${runId}/devices/${deviceId}`;

export class ActionService {
  private static pending = new Map<string, PendingAction>();
  private static lastResults = new Map<string, { deviceIds: string[]; runId: string }>();
  static readonly EXPIRY_MS = 60_000;

  static readonly registry: Record<string, ActionDefinition> = {
    OPEN_DEVICE: {
      category: 'UI_ACTION', risk: 'LOW', confirmationRequired: true,
      description: ({ runId, deviceId }) => `Open device details for ${deviceId} in run ${runId}.`,
      execute: (pending) => ({
        actionId: pending.actionId, status: 'EXECUTED',
        message: `Done. Opened details for ${pending.args.deviceId}.`,
        spokenText: `Done. I opened the details for ${pending.args.deviceId}.`,
        navigationUrl: devicePath(pending.args.runId!, pending.args.deviceId!),
        uiAction: { type: 'UI_ACTION', action: 'OPEN_DEVICE', target: pending.args.deviceId, path: devicePath(pending.args.runId!, pending.args.deviceId!) }
      })
    },
    OPEN_RUN: {
      category: 'UI_ACTION', risk: 'LOW', confirmationRequired: true,
      description: ({ runId }) => `Open burn-in run ${runId}.`,
      execute: (pending) => ({
        actionId: pending.actionId, status: 'EXECUTED', message: `Done. Opened run ${pending.args.runId}.`, spokenText: `Done. I opened run ${pending.args.runId}.`,
        navigationUrl: `/runs/${pending.args.runId}`, uiAction: { type: 'UI_ACTION', action: 'OPEN_RUN', target: pending.args.runId, path: `/runs/${pending.args.runId}` }
      })
    },
    OPEN_ALERTS: {
      category: 'UI_ACTION', risk: 'LOW', confirmationRequired: true,
      description: ({ runId }) => `Open anomaly alerts for run ${runId}.`,
      execute: (pending) => ({ actionId: pending.actionId, status: 'EXECUTED', message: `Done. Opened alerts for run ${pending.args.runId}.`, spokenText: 'Done. I opened the anomaly alerts.', navigationUrl: `/runs/${pending.args.runId}?view=alerts`, uiAction: { type: 'UI_ACTION', action: 'OPEN_ALERTS', target: pending.args.runId, path: `/runs/${pending.args.runId}?view=alerts` } })
    },
    OPEN_CRITICAL_DEVICES: {
      category: 'UI_ACTION', risk: 'LOW', confirmationRequired: true,
      description: ({ runId }) => `Open critical devices for run ${runId}.`,
      execute: (pending) => ({ actionId: pending.actionId, status: 'EXECUTED', message: `Done. Opened critical devices for run ${pending.args.runId}.`, spokenText: 'Done. I opened the critical devices.', navigationUrl: `/runs/${pending.args.runId}?view=critical`, uiAction: { type: 'UI_ACTION', action: 'OPEN_CRITICAL_DEVICES', target: pending.args.runId, path: `/runs/${pending.args.runId}?view=critical` } })
    },
    OPEN_TELEMETRY: {
      category: 'UI_ACTION', risk: 'LOW', confirmationRequired: true,
      description: ({ runId, deviceId }) => `Open telemetry for ${deviceId} in run ${runId}.`,
      execute: (pending) => ({ actionId: pending.actionId, status: 'EXECUTED', message: `Done. Opened telemetry for ${pending.args.deviceId}.`, spokenText: `Done. I opened telemetry for ${pending.args.deviceId}.`, navigationUrl: devicePath(pending.args.runId!, pending.args.deviceId!), uiAction: { type: 'UI_ACTION', action: 'OPEN_TELEMETRY', target: pending.args.deviceId, path: devicePath(pending.args.runId!, pending.args.deviceId!) } })
    },
    OPEN_ANOMALY: {
      category: 'UI_ACTION', risk: 'LOW', confirmationRequired: true,
      description: ({ runId, deviceId }) => `Open the anomaly explanation for ${deviceId} in run ${runId}.`,
      execute: (pending) => ({ actionId: pending.actionId, status: 'EXECUTED', message: `Done. Opened the anomaly explanation for ${pending.args.deviceId}.`, spokenText: `Done. I opened the anomaly explanation for ${pending.args.deviceId}.`, navigationUrl: devicePath(pending.args.runId!, pending.args.deviceId!), uiAction: { type: 'UI_ACTION', action: 'OPEN_ANOMALY', target: pending.args.deviceId, path: devicePath(pending.args.runId!, pending.args.deviceId!) } })
    },
    OPEN_SHAP: {
      category: 'UI_ACTION', risk: 'LOW', confirmationRequired: true,
      description: ({ runId, deviceId }) => `Open the SHAP explanation for ${deviceId} in run ${runId}.`,
      execute: (pending) => ({ actionId: pending.actionId, status: 'EXECUTED', message: `Done. Opened the SHAP explanation for ${pending.args.deviceId}.`, spokenText: `Done. I opened the SHAP explanation for ${pending.args.deviceId}.`, navigationUrl: devicePath(pending.args.runId!, pending.args.deviceId!), uiAction: { type: 'UI_ACTION', action: 'OPEN_SHAP', target: pending.args.deviceId, path: devicePath(pending.args.runId!, pending.args.deviceId!) } })
    },
    OPEN_REPORT: {
      category: 'UI_ACTION', risk: 'LOW', confirmationRequired: true,
      description: ({ runId }) => `Open the qualification report for run ${runId}.`,
      execute: (pending) => ({ actionId: pending.actionId, status: 'EXECUTED', message: `Done. Opened the qualification report for run ${pending.args.runId}.`, spokenText: 'Done. I opened the qualification report.', navigationUrl: `/reports?runId=${pending.args.runId}`, uiAction: { type: 'UI_ACTION', action: 'OPEN_REPORT', target: pending.args.runId, path: `/reports?runId=${pending.args.runId}` } })
    },
    FETCH_DEVICE_DETAILS: {
      category: 'UI_ACTION', risk: 'MEDIUM', confirmationRequired: true,
      description: ({ deviceId }) => `Fetch detailed device information for ${deviceId}.`,
      execute: (pending) => {
        const dev = db.devices.get(`${pending.args.runId}:${pending.args.deviceId}`);
        return dev ? { actionId: pending.actionId, status: 'EXECUTED', message: `Done. ${pending.args.deviceId} is ${dev.latestScores?.severity || 'nominal'} with anomaly score ${dev.latestScores?.ensembleScore || 0}%.`, spokenText: `Done. ${pending.args.deviceId} has an anomaly score of ${dev.latestScores?.ensembleScore || 0} percent.`, data: dev } : ActionService.failed(pending, `Device ${pending.args.deviceId} was not found.`);
      }
    },
    FETCH_TELEMETRY: {
      category: 'UI_ACTION', risk: 'MEDIUM', confirmationRequired: true,
      description: ({ deviceId }) => `Fetch detailed telemetry for ${deviceId}.`,
      execute: (pending) => {
        const telemetry = db.getTelemetryHistory(pending.args.runId!, pending.args.deviceId!);
        return { actionId: pending.actionId, status: 'EXECUTED', message: `Done. Fetched ${telemetry.length} telemetry samples for ${pending.args.deviceId}.`, spokenText: `Done. I fetched the telemetry for ${pending.args.deviceId}.`, data: telemetry, navigationUrl: devicePath(pending.args.runId!, pending.args.deviceId!), uiAction: { type: 'UI_ACTION', action: 'OPEN_TELEMETRY', target: pending.args.deviceId, path: devicePath(pending.args.runId!, pending.args.deviceId!) } };
      }
    },
    DISPOSITION: {
      category: 'STATE_CHANGE', risk: 'HIGH', confirmationRequired: true,
      description: ({ runId, deviceId, decision }) => `Mark ${deviceId} as ${decision === 'hold_fa' ? 'HOLD FOR FAILURE ANALYSIS' : decision?.toUpperCase()} in run ${runId}.`,
      execute: (pending, userRole, userName) => {
        if (userRole === 'operator') return ActionService.failed(pending, 'Operators cannot execute device dispositions.');
        const deviceId = pending.args.deviceId!;
        const runId = pending.args.runId!;
        const dev = db.devices.get(`${runId}:${deviceId}`);
        if (!dev) return ActionService.failed(pending, `Device ${deviceId} was not found.`);
        const decision = pending.args.decision!;
        const disposition: Disposition = { id: uuidv4(), deviceId, runId, engineerId: pending.userId, engineerName: `${userName || 'Engineer'} (via Sentinel Copilot)`, decision, comment: pending.args.reason || `Agent-authorized disposition: ${decision.toUpperCase()}`, decidedAt: new Date().toISOString() };
        db.dispositions.set(deviceId, disposition);
        dev.disposition = disposition;
        AuditService.logEvent({ runId, eventType: `COPILOT_DISPOSITION_${decision.toUpperCase()}`, actorId: pending.userId, actorName: userName, fromState: 'FLAGGED_ANOMALY', toState: decision.toUpperCase(), payload: { actionId: pending.actionId, deviceId, decision, reason: pending.args.reason } });
        const display = decision === 'hold_fa' ? 'HOLD FOR FAILURE ANALYSIS' : decision.toUpperCase();
        return { actionId: pending.actionId, status: 'EXECUTED', message: `Done. ${deviceId} is now marked as ${display}.`, spokenText: `Done. ${deviceId} is now marked as ${display}. The action was recorded in the audit trail.`, navigationUrl: devicePath(runId, deviceId), uiAction: { type: 'UI_ACTION', action: 'OPEN_DEVICE', target: deviceId, path: devicePath(runId, deviceId) }, data: { disposition } };
      }
    }
  };

  static rememberResult(scope: string, runId: string, deviceIds: string[]) {
    this.lastResults.set(scope, { runId, deviceIds });
  }

  static resolveDeviceReference(text: string, scope: string): string | undefined {
    const direct = normalizeDeviceId(text.match(/(?:dut|device|component|d)[ -]?(\d{1,4})/i)?.[0]);
    if (direct) return direct;
    if (/\b(first|1st|one)\b/i.test(text)) return this.lastResults.get(scope)?.deviceIds[0];
    return undefined;
  }

  static createPending(input: { action: string; args: ActionArguments; userId: string; sessionId: string; userRole?: UserRole; userName?: string }): PendingAction | { error: string } {
    const definition = this.registry[input.action];
    if (!definition) return { error: `Action ${input.action} is not registered.` };
    const args = { ...input.args, deviceId: normalizeDeviceId(input.args.deviceId) };
    if (args.runId && !db.runs.has(args.runId)) return { error: `Run ${args.runId} was not found.` };
    if (args.deviceId && !db.devices.has(`${args.runId}:${args.deviceId}`)) return { error: `Device ${args.deviceId} was not found in run ${args.runId}.` };
    const now = Date.now();
    const pending: PendingAction = { actionId: uuidv4(), userId: input.userId, sessionId: input.sessionId, action: input.action, category: definition.category, risk: definition.risk, toolName: input.action, args, description: definition.description(args), createdAt: new Date(now).toISOString(), expiresAt: new Date(now + this.EXPIRY_MS).toISOString(), status: 'PENDING' };
    this.pending.set(pending.actionId, pending);
    return pending;
  }

  static getPending(actionId: string) {
    return this.pending.get(actionId);
  }

  static confirm(actionId: string, userId: string, sessionId: string, userRole?: UserRole, userName?: string): ActionExecutionResult {
    const pending = this.pending.get(actionId);
    if (!pending || pending.userId !== userId || pending.sessionId !== sessionId) return { actionId, status: 'FAILED', message: 'That action is not available for this session.', spokenText: 'I could not verify that action for this session.' };
    if (pending.status !== 'PENDING') return { actionId, status: pending.status === 'EXPIRED' ? 'EXPIRED' : 'FAILED', message: `That action is already ${pending.status.toLowerCase()}.`, spokenText: `That action is already ${pending.status.toLowerCase()}.` };
    if (Date.now() > Date.parse(pending.expiresAt)) { pending.status = 'EXPIRED'; return { actionId, status: 'EXPIRED', message: 'That action has expired. Please ask me to perform it again.', spokenText: 'That action has expired. Please ask me to perform it again.' }; }
    pending.status = 'CONFIRMED';
    const result = this.registry[pending.action].execute(pending, userRole, userName);
    pending.status = result.status === 'EXECUTED' ? 'EXECUTED' : 'FAILED';
    AuditService.logEvent({ runId: pending.args.runId || 'run-isro-live-001', eventType: `COPILOT_ACTION_${result.status}`, actorId: userId, actorName: userName, payload: { actionId, action: pending.action, args: pending.args, result: result.message } });
    return result;
  }

  static cancel(actionId: string, userId: string, sessionId: string): ActionExecutionResult {
    const pending = this.pending.get(actionId);
    if (!pending || pending.userId !== userId || pending.sessionId !== sessionId) return { actionId, status: 'FAILED', message: 'That action is not available for this session.', spokenText: 'I could not verify that action for this session.' };
    if (pending.status !== 'PENDING') return { actionId, status: 'FAILED', message: `That action is already ${pending.status.toLowerCase()}.`, spokenText: `That action is already ${pending.status.toLowerCase()}.` };
    pending.status = 'CANCELLED';
    AuditService.logEvent({ runId: pending.args.runId || 'run-isro-live-001', eventType: 'COPILOT_ACTION_CANCELLED', actorId: userId, payload: { actionId, action: pending.action } });
    return { actionId, status: 'CANCELLED', message: 'Action cancelled. No changes were made.', spokenText: 'Action cancelled. No changes were made.' };
  }

  static isAffirmative(text: string) { return /^(yes|confirm|proceed|go ahead|do it|open it|fetch it|continue|okay|ok|sure|affirmative)\b/i.test(text.trim()); }
  static isNegative(text: string) { return /^(no|cancel|stop|abort|don't do it|never mind|nevermind|forget it|negative)\b/i.test(text.trim()); }
  static failed(pending: PendingAction, message: string): ActionExecutionResult { return { actionId: pending.actionId, status: 'FAILED', message, spokenText: message }; }
}
