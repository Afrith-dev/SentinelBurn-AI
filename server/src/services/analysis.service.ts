import { db } from '../database/store';
import { MLService } from './ml.service';

export interface TrendSummary {
  samples: number;
  latest?: Record<string, number>;
  min?: Record<string, number>;
  max?: Record<string, number>;
  change?: Record<string, number>;
  direction?: Record<string, 'rising' | 'falling' | 'stable'>;
}

export class AnalysisService {
  static getCurrentRun(runId?: string) {
    if (runId && db.runs.has(runId)) return db.runs.get(runId);
    return Array.from(db.runs.values()).find((run) => run.status === 'running') || Array.from(db.runs.values())[0];
  }

  static getRunStatus(runId: string) {
    const run = db.runs.get(runId);
    if (!run) return { runId, available: false, message: `Run ${runId} was not found.` };
    const deviceIds = db.runDevices.get(runId) || [];
    const reporting = deviceIds.filter((deviceId) => {
      const device = db.devices.get(`${runId}:${deviceId}`);
      return Boolean(device?.latestReadings || db.getTelemetryHistory(runId, deviceId).length);
    });
    return {
      available: true,
      runId,
      status: run.status,
      lotId: run.lotId,
      elapsedHours: run.elapsedHours,
      totalDevices: deviceIds.length,
      reportingDevices: reporting.length,
      reportingCoverage: deviceIds.length ? Number((reporting.length / deviceIds.length * 100).toFixed(1)) : 0,
      speedMultiplier: run.speedMultiplier
    };
  }

  static getLiveTelemetry(runId: string, limit = 200) {
    const deviceIds = (db.runDevices.get(runId) || []).slice(0, limit);
    return deviceIds.map((deviceId) => {
      const device = db.devices.get(`${runId}:${deviceId}`);
      const history = db.getTelemetryHistory(runId, deviceId);
      return {
        deviceId,
        latest: device?.latestReadings || history[history.length - 1]?.readings || null,
        samples: history.length,
        lastSampleAt: history[history.length - 1]?.time || null
      };
    }).filter((item) => item.latest);
  }

  static getAnomalies(runId: string, threshold = 40) {
    return (db.runDevices.get(runId) || []).map((deviceId) => {
      const device = db.devices.get(`${runId}:${deviceId}`);
      const score = device?.latestScores?.ensembleScore;
      return {
        deviceId,
        score: typeof score === 'number' ? score : null,
        severity: device?.latestScores?.severity || 'unknown',
        anomalyClass: device?.latestScores?.anomalyClassGuess || 'unknown',
        readings: device?.latestReadings || null
      };
    }).filter((item) => item.score !== null && item.score >= threshold)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  static getCriticalDevices(runId: string) {
    return this.getAnomalies(runId, 65);
  }

  static analyzeRunTrends(runId: string): TrendSummary {
    const deviceIds = db.runDevices.get(runId) || [];
    const values = deviceIds.flatMap((deviceId) => db.getTelemetryHistory(runId, deviceId).slice(-20)).map((sample) => ({
      voltage: Number(sample.readings?.voltage),
      current: Number(sample.readings?.current),
      leakageCurrent: Number(sample.readings?.leakageCurrent),
      temperature: Number(sample.readings?.temperature)
    }));
    if (!values.length) return { samples: 0 };
    const fields = ['voltage', 'current', 'leakageCurrent', 'temperature'] as const;
    const latest: Record<string, number> = {};
    const min: Record<string, number> = {};
    const max: Record<string, number> = {};
    for (const field of fields) {
      const fieldValues = values.map((value) => value[field]).filter(Number.isFinite);
      if (!fieldValues.length) continue;
      latest[field] = fieldValues[fieldValues.length - 1];
      min[field] = Math.min(...fieldValues);
      max[field] = Math.max(...fieldValues);
    }
    const change = Object.fromEntries(fields.filter((field) => latest[field] !== undefined).map((field) => [field, Number((max[field] - min[field]).toPrecision(6))]));
    const direction = Object.fromEntries(fields.filter((field) => latest[field] !== undefined).map((field) => {
      const delta = change[field];
      return [field, delta === 0 ? 'stable' : latest[field] >= (min[field] + max[field]) / 2 ? 'rising' : 'falling'];
    })) as TrendSummary['direction'];
    return { samples: values.length, latest, min, max, change, direction };
  }

  static async getDeviceAnalysis(runId: string, deviceId: string) {
    const device = db.devices.get(`${runId}:${deviceId}`);
    if (!device) return { available: false, message: `Device ${deviceId} was not found in run ${runId}.` };
    const history = db.getTelemetryHistory(runId, deviceId);
    const readings = device.latestReadings || history[history.length - 1]?.readings;
    const scores = device.latestScores || null;
    const explanation = readings && scores ? await MLService.getExplanation({
      runId,
      deviceId,
      channelId: device.channelId,
      readings,
      history: history.slice(-20),
      scores
    }) : null;
    return {
      available: true,
      deviceId,
      serial: device.deviceSerial,
      channelId: device.channelId,
      readings: readings || null,
      scores,
      samples: history.length,
      trend: this.analyzeDeviceTrend(history),
      explanation
    };
  }

  static analyzeDeviceTrend(history: any[]) {
    if (!history.length) return { samples: 0 };
    const fields = ['voltage', 'current', 'leakageCurrent', 'temperature'];
    return Object.fromEntries(fields.map((field) => {
      const values = history.map((sample) => Number(sample.readings?.[field])).filter(Number.isFinite);
      const first = values[0];
      const last = values[values.length - 1];
      return [field, { first, last, delta: Number((last - first).toPrecision(6)), samples: values.length }];
    }));
  }

  static async analyzeRun(runId: string) {
    const status = this.getRunStatus(runId);
    const telemetry = this.getLiveTelemetry(runId);
    const anomalies = this.getAnomalies(runId);
    const critical = this.getCriticalDevices(runId);
    const trends = this.analyzeRunTrends(runId);
    const highest = critical[0] || anomalies[0];
    const highestAnalysis = highest ? await this.getDeviceAnalysis(runId, highest.deviceId) : null;
    return {
      run: status,
      telemetry: { reportingDevices: telemetry.length, devices: telemetry },
      anomalies,
      criticalDevices: critical,
      trends,
      highestRiskDevice: highestAnalysis,
      recommendation: critical.length ? `Inspect ${critical[0].deviceId} first; it has the highest current anomaly score.` : anomalies.length ? 'Review the elevated-warning devices and continue monitoring their trends.' : 'No elevated anomaly scores are currently available from the backend.'
    };
  }
}
