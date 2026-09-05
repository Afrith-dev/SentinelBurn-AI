import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'sentinelburn_aerospace_super_secure_jwt_secret_key_2026_sih',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://sentinel:burnai@localhost:5432/sentinelburn',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  SIMULATOR_URL: process.env.SIMULATOR_URL || 'http://localhost:8001',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GEMINI_LIVE_MODEL: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview',
  SIM_DEFAULT_DEVICE_COUNT: parseInt(process.env.SIM_DEFAULT_DEVICE_COUNT || '200', 10),
  SIM_DEFAULT_ANOMALY_RATE: parseFloat(process.env.SIM_DEFAULT_ANOMALY_RATE || '0.05'),
  SIM_DEFAULT_SPEED_MULTIPLIER: parseFloat(process.env.SIM_DEFAULT_SPEED_MULTIPLIER || '60.0'),
};
