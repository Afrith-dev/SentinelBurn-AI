import { create } from 'zustand';
import { Run, Device, Alert, TelemetrySample } from '../types';
import { runsApi, devicesApi, alertsApi } from '../services/api';
import { getSocket, joinRunRoom, leaveRunRoom } from '../services/socket';

interface RunState {
  activeRun: Run | null;
  devices: Device[];
  alerts: Alert[];
  unreadAlertCount: number;
  selectedDeviceId: string | null;
  cohortStats: { leakageMean: number; leakageStd: number } | null;
  telemetryHistory: Record<string, TelemetrySample[]>;
  isLoading: boolean;
  isSocketConnected: boolean;

  fetchRun: (runId: string) => Promise<void>;
  fetchDevices: (runId: string) => Promise<void>;
  fetchAlerts: (runId: string) => Promise<void>;
  startRun: (runId: string) => Promise<void>;
  pauseRun: (runId: string) => Promise<void>;
  completeRun: (runId: string) => Promise<void>;
  setSelectedDevice: (deviceId: string | null) => void;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  initializeSocketListeners: (runId: string) => () => void;
}

export const useRunStore = create<RunState>((set, get) => ({
  activeRun: null,
  devices: [],
  alerts: [],
  unreadAlertCount: 0,
  selectedDeviceId: null,
  cohortStats: null,
  telemetryHistory: {},
  isLoading: false,
  isSocketConnected: false,

  fetchRun: async (runId: string) => {
    try {
      const run = await runsApi.getRun(runId);
      set({ activeRun: run });
    } catch (e) {
      console.error('Error fetching run:', e);
    }
  },

  fetchDevices: async (runId: string) => {
    try {
      const devices = await devicesApi.getDevices(runId);
      set({ devices });
    } catch (e) {
      console.error('Error fetching devices:', e);
    }
  },

  fetchAlerts: async (runId: string) => {
    try {
      const alerts = await alertsApi.getAlerts(runId);
      set({ alerts, unreadAlertCount: alerts.filter((a: Alert) => !a.acknowledgedAt).length });
    } catch (e) {
      console.error('Error fetching alerts:', e);
    }
  },

  startRun: async (runId: string) => {
    try {
      const res = await runsApi.startRun(runId);
      set((state) => ({
        activeRun: state.activeRun ? { ...state.activeRun, status: 'running' } : null
      }));
    } catch (e) {
      console.error('Error starting run:', e);
    }
  },

  pauseRun: async (runId: string) => {
    try {
      const res = await runsApi.pauseRun(runId);
      set((state) => ({
        activeRun: state.activeRun ? { ...state.activeRun, status: res.status } : null
      }));
    } catch (e) {
      console.error('Error pausing run:', e);
    }
  },

  completeRun: async (runId: string) => {
    try {
      const res = await runsApi.completeRun(runId);
      set((state) => ({
        activeRun: state.activeRun ? { ...state.activeRun, status: 'completed' } : null
      }));
    } catch (e) {
      console.error('Error completing run:', e);
    }
  },

  setSelectedDevice: (deviceId: string | null) => {
    set({ selectedDeviceId: deviceId });
  },

  acknowledgeAlert: async (alertId: string) => {
    try {
      await alertsApi.acknowledgeAlert(alertId);
      set((state) => ({
        alerts: state.alerts.map(a => a.id === alertId ? { ...a, acknowledgedAt: new Date().toISOString() } : a),
        unreadAlertCount: Math.max(0, state.unreadAlertCount - 1)
      }));
    } catch (e) {
      console.error('Error acknowledging alert:', e);
    }
  },

  initializeSocketListeners: (runId: string) => {
    const socket = getSocket();
    joinRunRoom(runId);
    set({ isSocketConnected: socket.connected });

    const handleConnect = () => set({ isSocketConnected: true });
    const handleDisconnect = () => set({ isSocketConnected: false });

    const handleTelemetryTick = (data: any) => {
      if (data.runId !== runId) return;

      set((state) => {
        const updatedDevices = [...state.devices];
        const newHistory = { ...state.telemetryHistory };

        // Map live device readings
        for (const snap of data.devices) {
          const idx = updatedDevices.findIndex(d => d.id === snap.deviceId);
          if (idx !== -1) {
            updatedDevices[idx] = {
              ...updatedDevices[idx],
              latestReadings: snap.readings,
              latestScores: snap.scores
            };
          }

          // Accumulate rolling history for selected device
          if (!newHistory[snap.deviceId]) newHistory[snap.deviceId] = [];
          const devHist = [...newHistory[snap.deviceId]];
          devHist.push({
            time: data.timestamp,
            runId,
            deviceId: snap.deviceId,
            readings: snap.readings,
            elapsedHours: data.elapsedHours
          });
          if (devHist.length > 50) devHist.shift();
          newHistory[snap.deviceId] = devHist;
        }

        return {
          devices: updatedDevices,
          cohortStats: data.cohortStats,
          telemetryHistory: newHistory,
          activeRun: state.activeRun ? { ...state.activeRun, elapsedHours: data.elapsedHours } : null
        };
      });
    };

    const handleAnomalyFlagged = (alertPayload: any) => {
      if (alertPayload.runId !== runId) return;

      const newAlert: Alert = {
        id: alertPayload.alertId || `alt-${Date.now()}`,
        runId,
        deviceId: alertPayload.deviceId,
        deviceSerial: alertPayload.deviceSerial,
        channelId: alertPayload.channelId,
        score: alertPayload.scores?.ensembleScore || 75,
        severity: alertPayload.severity || 'critical',
        message: alertPayload.explanation?.summary || 'Anomaly flag raised',
        explanation: alertPayload.explanation,
        createdAt: alertPayload.timestamp || new Date().toISOString()
      };

      set((state) => ({
        alerts: [newAlert, ...state.alerts],
        unreadAlertCount: state.unreadAlertCount + 1
      }));
    };

    const handleRunStatusChanged = (data: any) => {
      if (data.runId === runId) {
        set((state) => ({
          activeRun: state.activeRun ? { ...state.activeRun, status: data.status } : null
        }));
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('telemetry:tick', handleTelemetryTick);
    socket.on('anomaly:flagged', handleAnomalyFlagged);
    socket.on('run:status_changed', handleRunStatusChanged);

    return () => {
      leaveRunRoom(runId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('telemetry:tick', handleTelemetryTick);
      socket.off('anomaly:flagged', handleAnomalyFlagged);
      socket.off('run:status_changed', handleRunStatusChanged);
    };
  }
}));
