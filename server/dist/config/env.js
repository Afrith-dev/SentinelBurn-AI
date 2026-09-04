"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env from workspace root or current directory
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
dotenv_1.default.config();
exports.ENV = {
    PORT: parseInt(process.env.PORT || '4000', 10),
    JWT_SECRET: process.env.JWT_SECRET || 'sentinelburn_aerospace_super_secure_jwt_secret_key_2026_sih',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://sentinel:burnai@localhost:5432/sentinelburn',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:8000',
    SIMULATOR_URL: process.env.SIMULATOR_URL || 'http://localhost:8001',
    SIM_DEFAULT_DEVICE_COUNT: parseInt(process.env.SIM_DEFAULT_DEVICE_COUNT || '200', 10),
    SIM_DEFAULT_ANOMALY_RATE: parseFloat(process.env.SIM_DEFAULT_ANOMALY_RATE || '0.05'),
    SIM_DEFAULT_SPEED_MULTIPLIER: parseFloat(process.env.SIM_DEFAULT_SPEED_MULTIPLIER || '60.0'),
};
