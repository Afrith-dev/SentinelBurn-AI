import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sentinel_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (credentials: { email: string; password?: string }) =>
    api.post('/login', credentials).then(r => r.data),
  register: (data: any) =>
    api.post('/register', data).then(r => r.data),
  loginGoogle: (payload: { credential?: string; email?: string; name?: string }) =>
    api.post('/auth/google', payload).then(r => r.data),
  getGoogleConfig: () =>
    api.get('/auth/google/config').then(r => r.data),
  getProfile: () =>
    api.get('/me').then(r => r.data),
};

export const runsApi = {
  getLots: () => api.get('/lots').then(r => r.data),
  createLot: (lotData: any) => api.post('/lots', lotData).then(r => r.data),
  getRuns: () => api.get('/runs').then(r => r.data),
  createRun: (runData: any) => api.post('/runs', runData).then(r => r.data),
  getRun: (id: string) => api.get(`/runs/${id}`).then(r => r.data),
  startRun: (id: string) => api.post(`/runs/${id}/start`).then(r => r.data),
  pauseRun: (id: string) => api.post(`/runs/${id}/pause`).then(r => r.data),
  completeRun: (id: string) => api.post(`/runs/${id}/complete`).then(r => r.data),
  getAuditLog: (id: string) => api.get(`/runs/${id}/audit`).then(r => r.data),
  verifyAuditChain: (id: string) => api.get(`/runs/${id}/audit/verify`).then(r => r.data),
};

export const devicesApi = {
  getDevices: (runId: string) => api.get(`/runs/${runId}/devices`).then(r => r.data),
  getDevice: (runId: string, deviceId: string) => api.get(`/runs/${runId}/devices/${deviceId}`).then(r => r.data),
  getTelemetry: (runId: string, deviceId: string) => api.get(`/runs/${runId}/devices/${deviceId}/telemetry`).then(r => r.data),
  getExplanation: (runId: string, deviceId: string) => api.get(`/runs/${runId}/devices/${deviceId}/explain`).then(r => r.data),
  setDisposition: (deviceId: string, data: { runId: string; decision: string; comment?: string }) =>
    api.post(`/devices/${deviceId}/disposition`, data).then(r => r.data),
  getHoldFADevices: () => api.get('/devices/hold-fa').then(r => r.data),
};

export const alertsApi = {
  getAlerts: (runId: string) => api.get(`/runs/${runId}/alerts`).then(r => r.data),
  acknowledgeAlert: (alertId: string) => api.post(`/alerts/${alertId}/acknowledge`).then(r => r.data),
};

export const reportsApi = {
  getReport: (runId: string) => api.get(`/runs/${runId}/report`).then(r => r.data),
};

export const modelsApi = {
  getMetrics: () => api.get('/models').then(r => r.data),
  retrain: () => api.post('/models/retrain').then(r => r.data),
};

export const simulatorApi = {
  getStatus: () => api.get('/simulator/status').then(r => r.data),
  injectAnomaly: (runId: string, data: { deviceId: string; anomalyClass: string; magnitude?: number }) =>
    api.post(`/simulator/runs/${runId}/inject-anomaly`, data).then(r => r.data),
};

export const copilotApi = {
  query: (data: { query?: string; runId?: string; pendingActionId?: string; sessionId?: string }) =>
    api.post('/copilot/query', data).then(r => r.data),
  getGeminiStatus: () => api.get('/copilot/gemini/status').then(r => r.data),
  testGemini: (prompt: string) => api.post('/copilot/gemini/test', { prompt }).then(r => r.data),
};

export const operatorApi = {
  getShiftNotes: (runId: string) => api.get(`/operator/shift-notes/${runId}`).then(r => r.data),
  saveShiftNote: (data: { runId: string; note: string; author?: string }) =>
    api.post('/operator/shift-notes', data).then(r => r.data),
};

export const adminApi = {
  getUsers: () => api.get('/admin/users').then(r => r.data),
  deactivateUser: (id: string) => api.patch(`/admin/users/${id}/deactivate`).then(r => r.data),
  getHealth: () => api.get('/health').then(r => r.data),
};


