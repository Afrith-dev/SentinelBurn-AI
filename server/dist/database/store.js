"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.DataStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const STORE_FILE = path_1.default.join(DATA_DIR, 'store.json');
class DataStore {
    users = new Map();
    lots = new Map();
    runs = new Map();
    devices = new Map(); // key: deviceId or `${runId}:${deviceId}`
    runDevices = new Map(); // runId -> deviceIds
    telemetryHistory = new Map(); // key: `${runId}:${deviceId}` -> last 60 samples
    alerts = new Map();
    dispositions = new Map(); // key: deviceId
    auditLogs = [];
    constructor() {
        this.ensureDataDir();
        this.seedDefaultUsers();
        this.seedDefaultLotAndRun();
    }
    ensureDataDir() {
        if (!fs_1.default.existsSync(DATA_DIR)) {
            try {
                fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
            }
            catch (err) {
                console.warn('Could not create data directory, using in-memory store:', err);
            }
        }
    }
    seedDefaultUsers() {
        const defaultPassword = 'password123';
        const salt = bcryptjs_1.default.genSaltSync(10);
        const hash = bcryptjs_1.default.hashSync(defaultPassword, salt);
        const defaultUsers = [
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
    seedDefaultLotAndRun() {
        const defaultLotId = 'lot-isro-2026-001';
        const defaultLot = {
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
        const defaultRun = {
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
        const deviceIds = [];
        for (let i = 1; i <= 200; i++) {
            const devId = `d-${String(i).padStart(4, '0')}`;
            deviceIds.push(devId);
            const dev = {
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
    addTelemetrySample(sample) {
        const key = `${sample.runId}:${sample.deviceId}`;
        if (!this.telemetryHistory.has(key)) {
            this.telemetryHistory.set(key, []);
        }
        const history = this.telemetryHistory.get(key);
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
    getTelemetryHistory(runId, deviceId) {
        const key = `${runId}:${deviceId}`;
        return this.telemetryHistory.get(key) || [];
    }
}
exports.DataStore = DataStore;
exports.db = new DataStore();
