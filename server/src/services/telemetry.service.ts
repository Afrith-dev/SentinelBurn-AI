import { db } from '../database/store';
import { TelemetrySample, AnomalyScores, Alert } from '../types';
import { MLService } from './ml.service';
import { SocketHandler } from '../socket/socketHandler';
import { v4 as uuidv4 } from 'uuid';

export class TelemetryService {
  /**
   * Ingests a high-frequency tick batch of telemetry from simulator or DAQ
   */
  static async ingestBatch(runId: string, elapsedHours: number, samples: TelemetrySample[]) {
    const run = db.runs.get(runId);
    if (run) {
      run.elapsedHours = elapsedHours;
      if (run.status === 'created') {
        run.status = 'running';
        run.startedAt = run.startedAt || new Date().toISOString();
        SocketHandler.broadcastRunStatusChanged(runId, { runId, status: 'running' });
      }
    }

    // 1. Calculate cohort statistics for this tick
    let sumLeakage = 0;
    for (const s of samples) {
      sumLeakage += s.readings.leakageCurrent;
      db.addTelemetrySample(s);
    }
    const leakageMean = sumLeakage / (samples.length || 1);
    
    let sumVariance = 0;
    for (const s of samples) {
      sumVariance += Math.pow(s.readings.leakageCurrent - leakageMean, 2);
    }
    const leakageStd = Math.sqrt(sumVariance / (samples.length || 1));
    const cohortStats = { leakageMean, leakageStd };

    // 2. Score batch with multi-model ensemble
    const scoresMap = await MLService.scoreBatch(
      runId,
      samples,
      db.telemetryHistory,
      cohortStats
    );

    // 3. Process scores, detect alerts, and update devices
    const deviceSnapshots: any[] = [];

    for (const s of samples) {
      const scores = scoresMap.get(s.deviceId) || {
        pointScore: 0.1,
        driftScore: 0.1,
        sequenceScore: 0.1,
        ensembleScore: 5.0,
        severity: 'nominal' as const
      };

      const devKey = `${runId}:${s.deviceId}`;
      const dev = db.devices.get(devKey);
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
        const existingAlert = Array.from(db.alerts.values()).find(
          a => a.runId === runId && a.deviceId === s.deviceId && !a.acknowledgedAt
        );

        if (!existingAlert || scores.ensembleScore > existingAlert.score + 10) {
          const explanation = await MLService.getExplanation({
            runId,
            deviceId: s.deviceId,
            channelId: s.channelId || 1,
            readings: s.readings,
            history: (db.telemetryHistory.get(devKey) || []).slice(-15),
            scores,
            cohortStats
          });

          const alert: Alert = {
            id: uuidv4(),
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

          db.alerts.set(alert.id, alert);

          // Emit real-time alert to UI conforming to Appendix C
          SocketHandler.broadcastAnomalyFlagged(runId, {
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
    SocketHandler.broadcastTelemetryTick(runId, {
      runId,
      elapsedHours,
      cohortStats,
      timestamp: samples[0]?.time || new Date().toISOString(),
      devices: deviceSnapshots
    });

    return { processed: samples.length, elapsedHours };
  }
}
