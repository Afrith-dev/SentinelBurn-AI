import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, Lot, Run, Device, TelemetrySample, AnomalyScores, Alert, Disposition, RunAuditLogRow } from '../types';

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export class DataStore {
  users: Map<string, User> = new Map();
  lots: Map<string, Lot> = new Map();
  runs: Map<string, Run> = new Map();
  devices: Map<string, Device> = new Map(); // key: deviceId or `${runId}:${deviceId}`
  runDevices: Map<string, string[]> = new Map(); // runId -> deviceIds
  telemetryHistory: Map<string, TelemetrySample[]> = new Map(); // key: `${runId}:${deviceId}` -> last 60 samples
  alerts: Map<string, Alert> = new Map();
  dispositions: Map<string, Disposition> = new Map(); // key: deviceId
  auditLogs: RunAuditLogRow[] = [];

  constructor() {
    this.ensureDataDir();
    this.seedDefaultUsers();
    this.seedDefaultLotAndRun();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.warn('Could not create data directory, using in-memory store:', err);
      }
    }
  }

  private seedDefaultUsers() {
    const defaultPassword = 'password123';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(defaultPassword, salt);

    const defaultUsers: Array<Omit<User, 'createdAt'>> = [
      {
        id: 'u-admin-01',
        name: 'Dr. Vikram Sarabhai',
        email: 'admin@sentinelburn.aero',
        passwordHash: hash,
        role: 'admin',
      },
      {
        id: 'u-rel-01',
        name: 'K. Radhakrishnan (Reliability Lead)',
        email: 'engineer@sentinelburn.aero',
        passwordHash: hash,
        role: 'reliability_engineer',
      },
      {
        id: 'u-qa-01',
        name: 'A. S. Kiran Kumar (QA Director)',
        email: 'qa@sentinelburn.aero',
        passwordHash: hash,
        role: 'qa_manager',
      },
      {
        id: 'u-op-01',
        name: 'Floor Operator 04',
        email: 'operator@sentinelburn.aero',
        passwordHash: hash,
        role: 'operator',
      },
      {
        id: 'u-fa-01',
        name: 'Dr. Tessy Thomas (Failure Analysis)',
        email: 'fa@sentinelburn.aero',
        passwordHash: hash,
        role: 'fa_engineer',
      }
    ];

    for (const u of defaultUsers) {
      this.users.set(u.email, {
        ...u,
        createdAt: new Date().toISOString()
      });
    }
  }

  private seedDefaultLotAndRun() {
    const defaultLotId = 'lot-isro-2026-001';
    const defaultLot: Lot = {
      id: defaultLotId,
      partNumber: 'HMC-SPACE-9021',
      manufacturer: 'Semi-Conductor Laboratory (SCL) / ISRO',
      dateCode: '2614-PID-09',
      specReference: 'ISRO-PAS-206 Rev D / MIL-STD-883K Method 1015',
      quantity: 200,
      createdBy: 'u-rel-01',
      createdAt: new Date().toISOString()
    };
    this.lots.set(defaultLotId, defaultLot);

    const defaultRunId = 'run-isro-live-001';
    const defaultRun: Run = {
      id: defaultRunId,
      lotId: defaultLotId,
      lot: defaultLot,
      status: 'created',
      speedMultiplier: 60.0,
      startedAt: undefined,
      createdAt: new Date().toISOString(),
      elapsedHours: 0.0,
      anomalyInjectionConfig: {
        anomalyRate: 0.05,
        targetClasses: ['sudden_shift', 'gradual_drift', 'intermittent_spike', 'cohort_outlier', 'thermal_lag']
      }
    };
    this.runs.set(defaultRunId, defaultRun);

    // Initialize 200 DUT records for this default run
    const deviceIds: string[] = [];
    for (let i = 1; i <= 200; i++) {
      const devId = `d-${String(i).padStart(4, '0')}`;
      deviceIds.push(devId);
      const dev: Device = {
        id: devId,
        runId: defaultRunId,
        deviceSerial: `HMC-2026-${String(i).padStart(4, '0')}`,
        channelId: i,
        cohortBaselineJson: {
          nominalVoltage: 5.0,
          nominalCurrent: 0.18,
          nominalLeakage: 0.0025,
          nominalTemp: 125.0
        },
        createdAt: new Date().toISOString()
      };
      this.devices.set(`${defaultRunId}:${devId}`, dev);
    }
    this.runDevices.set(defaultRunId, deviceIds);
  }

  // Telemetry buffer management (rolling window of 50 samples per DUT)
  addTelemetrySample(sample: TelemetrySample) {
    const key = `${sample.runId}:${sample.deviceId}`;
    if (!this.telemetryHistory.has(key)) {
      this.telemetryHistory.set(key, []);
    }
    const history = this.telemetryHistory.get(key)!;
    history.push(sample);
    if (history.length > 50) {
      history.shift();
    }

    // Update latest reading on device object
    const dev = this.devices.get(key);
    if (dev) {
      dev.latestReadings = sample.readings;
    }
  }

  getTelemetryHistory(runId: string, deviceId: string): TelemetrySample[] {
    const key = `${runId}:${deviceId}`;
    return this.telemetryHistory.get(key) || [];
  }
}

export const db = new DataStore();
