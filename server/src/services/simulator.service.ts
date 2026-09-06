import { db } from '../database/store';
import { TelemetrySample } from '../types';
import { TelemetryService } from './telemetry.service';

interface InjectedAnomaly {
  deviceId: string;
  anomalyClass: string;
  magnitude: number;
  injectedAtHours: number;
}

export class SimulatorService {
  private static activeTimers = new Map<string, NodeJS.Timeout>();
  private static injectedAnomalies = new Map<string, Map<string, InjectedAnomaly>>(); // runId -> (deviceId -> Anomaly)

  /**
   * Start or resume simulation for a run
   */
  static startRun(runId: string) {
    if (this.activeTimers.has(runId)) {
      return; // Already running
    }

    const run = db.runs.get(runId);
    if (!run) return;

    // Pre-seed default calibrated anomaly channels if none configured yet
    if (!this.injectedAnomalies.has(runId)) {
      const anomalyMap = new Map<string, InjectedAnomaly>();
      const deviceIds = db.runDevices.get(runId) || [];
      const rate = run.anomalyInjectionConfig?.anomalyRate || 0.05;
      const count = Math.max(1, Math.floor(deviceIds.length * rate));
      const classes = ['gradual_drift', 'sudden_shift', 'intermittent_spike', 'cohort_outlier', 'thermal_lag'];

      for (let i = 0; i < count; i++) {
        const step = Math.floor(deviceIds.length / (count + 1));
        const devIndex = Math.min(deviceIds.length - 1, Math.max(0, (i + 1) * step - 1));
        const devId = deviceIds[devIndex];
        anomalyMap.set(devId, {
          deviceId: devId,
          anomalyClass: classes[i % classes.length],
          magnitude: 2.0,
          injectedAtHours: 0.1 + i * 0.5
        });
      }
      this.injectedAnomalies.set(runId, anomalyMap);
    }

    // Simulation tick every 1000ms
    const timer = setInterval(async () => {
      try {
        await this.stepSimulationTick(runId);
      } catch (err) {
        console.error(`Simulation tick error for run ${runId}:`, err);
      }
    }, 1000);

    this.activeTimers.set(runId, timer);
    console.log(`[SimulatorEngine] Started in-process telemetry generation for run ${runId}`);
  }

  /**
   * Pause simulation for a run
   */
  static pauseRun(runId: string) {
    const timer = this.activeTimers.get(runId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(runId);
      console.log(`[SimulatorEngine] Paused telemetry generation for run ${runId}`);
    }
  }

  /**
   * Stop / complete simulation for a run
   */
  static stopRun(runId: string) {
    this.pauseRun(runId);
    this.injectedAnomalies.delete(runId);
  }

  /**
   * Inject anomaly into a specific device in a run
   */
  static injectAnomaly(runId: string, deviceId: string, anomalyClass: string, magnitude: number = 2.5) {
    if (!this.injectedAnomalies.has(runId)) {
      this.injectedAnomalies.set(runId, new Map());
    }
    const run = db.runs.get(runId);
    const elapsed = run?.elapsedHours || 0.0;

    const anomalies = this.injectedAnomalies.get(runId)!;
    anomalies.set(deviceId, {
      deviceId,
      anomalyClass,
      magnitude,
      injectedAtHours: elapsed
    });

    console.log(`[SimulatorEngine] Anomaly ${anomalyClass} (mag: ${magnitude}) injected into ${deviceId} on run ${runId}`);
    return { status: 'injected', runId, deviceId, anomalyClass, magnitude };
  }

  /**
   * Generate one tick of telemetry samples across all devices and ingest
   */
  private static async stepSimulationTick(runId: string) {
    const run = db.runs.get(runId);
    if (!run || run.status !== 'running') {
      this.pauseRun(runId);
      return;
    }

    const deviceIds = db.runDevices.get(runId) || [];
    if (deviceIds.length === 0) return;

    // Advance elapsed hours by speed multiplier
    // At 60x, 1 sec realtime = 60 sec simulation = 1/60 hr ≈ 0.0167 hr
    const speed = run.speedMultiplier || 60.0;
    const deltaHours = (speed / 3600.0) * 0.5;
    run.elapsedHours = parseFloat((run.elapsedHours + deltaHours).toFixed(2));

    const anomalies = this.injectedAnomalies.get(runId) || new Map<string, InjectedAnomaly>();
    const nowIso = new Date().toISOString();
    const samples: TelemetrySample[] = [];

    for (let i = 0; i < deviceIds.length; i++) {
      const devId = deviceIds[i];
      const channelId = i + 1;
      const injected = anomalies.get(devId);

      // Baseline nominal physics values with slight Gaussian noise
      let voltage = 5.0 + (Math.random() - 0.5) * 0.02; // 5.0V ± 10mV
      let current = 0.18 + (Math.random() - 0.5) * 0.005; // 180mA ± 2.5mA
      let leakage = 0.0025 + Math.abs((Math.random() - 0.5) * 0.0004); // ~2.5µA
      let temperature = 125.0 + (Math.random() - 0.5) * 0.4; // 125°C ± 0.2°C

      // Add aging drift
      leakage += run.elapsedHours * 0.00002;

      // Apply injected anomaly signature if present
      if (injected) {
        const timeSinceInject = Math.max(0, run.elapsedHours - injected.injectedAtHours);
        const mag = injected.magnitude || 2.0;

        switch (injected.anomalyClass) {
          case 'gradual_drift':
            // Exponentially escalating leakage current & temperature rise
            leakage += (0.003 * mag) * (1 + timeSinceInject * 2.5);
            temperature += (4.0 * mag) * (1 + timeSinceInject * 0.8);
            current += (0.02 * mag);
            break;

          case 'sudden_shift':
            // Instant step change in leakage and voltage drop
            leakage += 0.008 * mag;
            voltage -= 0.15 * mag;
            temperature += 8.5 * mag;
            break;

          case 'intermittent_spike':
            // High frequency bursts
            if (Math.random() < 0.6) {
              leakage += 0.012 * mag;
              current += 0.06 * mag;
              temperature += 12.0 * mag;
            }
            break;

          case 'cohort_outlier':
            // Steady statistical deviation from cohort baseline
            leakage += 0.006 * mag;
            temperature += 6.0 * mag;
            break;

          case 'thermal_lag':
            // Heat dissipation failure, lagging temperature runaway
            temperature += 18.0 * mag * (1 + timeSinceInject * 1.2);
            leakage += 0.005 * mag;
            break;

          default:
            leakage += 0.005 * mag;
            temperature += 5.0 * mag;
            break;
        }
      }

      samples.push({
        deviceId: devId,
        channelId,
        runId,
        time: nowIso,
        elapsedHours: run.elapsedHours,
        readings: {
          voltage: parseFloat(voltage.toFixed(4)),
          current: parseFloat(current.toFixed(4)),
          leakageCurrent: parseFloat(leakage.toFixed(6)),
          temperature: parseFloat(temperature.toFixed(2))
        }
      });
    }

    // Ingest into telemetry service which calculates scores, triggers alerts, and broadcasts via Socket.IO
    await TelemetryService.ingestBatch(runId, run.elapsedHours, samples);
  }

  static getActiveRunIds(): string[] {
    return Array.from(this.activeTimers.keys());
  }
}
