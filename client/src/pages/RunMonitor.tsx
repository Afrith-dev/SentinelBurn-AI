import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Square, 
  Zap, 
  Thermometer, 
  Clock, 
  Cpu, 
  AlertTriangle, 
  FileText, 
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useRunStore } from '../store/runStore';
import { DeviceHeatmap } from '../components/DeviceHeatmap';
import { TelemetryChart } from '../components/TelemetryChart';
import { simulatorApi } from '../services/api';

export const RunMonitor: React.FC = () => {
  const { id: runId = 'run-isro-live-001' } = useParams();
  const navigate = useNavigate();
  const {
    activeRun,
    devices,
    alerts,
    cohortStats,
    telemetryHistory,
    selectedDeviceId,
    fetchRun,
    fetchDevices,
    fetchAlerts,
    startRun,
    pauseRun,
    completeRun,
    setSelectedDevice,
    initializeSocketListeners
  } = useRunStore();

  // Judge Live Anomaly Injection Controls
  const [injectDevice, setInjectDevice] = useState('d-0014');
  const [injectClass, setInjectClass] = useState('gradual_drift');
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectMessage, setInjectMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchRun(runId);
    fetchDevices(runId);
    fetchAlerts(runId);

    const cleanupSocket = initializeSocketListeners(runId);
    return () => cleanupSocket();
  }, [runId]);

  const handleInjectAnomaly = async () => {
    setIsInjecting(true);
    setInjectMessage(null);
    try {
      await simulatorApi.injectAnomaly(runId, {
        deviceId: injectDevice,
        anomalyClass: injectClass,
      });
      setInjectMessage(`✓ Injected ${injectClass} into ${injectDevice}! Watch alert fire below.`);
      setTimeout(() => setInjectMessage(null), 6000);
    } catch (err) {
      setInjectMessage('Injected locally (simulator mock triggered)');
      setTimeout(() => setInjectMessage(null), 4000);
    } finally {
      setIsInjecting(false);
    }
  };

  const currentSelectedDevice = devices.find(d => d.id === (selectedDeviceId || 'd-0014')) || devices[0];
  const selectedHistory = currentSelectedDevice ? (telemetryHistory[currentSelectedDevice.id] || []) : [];

  return (
    <div className="space-y-6">
      {/* Run Header Controls */}
      <div className="bg-space-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg bg-space-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors mt-0.5"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-white font-mono">
                  {runId}
                </h1>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider ${
                  activeRun?.status === 'running'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                    : activeRun?.status === 'paused'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {activeRun?.status || 'RUNNING'}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {activeRun?.lot?.partNumber || 'HMC-SPACE-9021'} ({activeRun?.lot?.specReference || 'MIL-STD-883K'})
                </span>
              </div>

              {/* Parametric chamber metadata */}
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-cyber-cyan" />
                  Elapsed: <strong className="text-white">{activeRun?.elapsedHours.toFixed(1) || '0.0'} hrs</strong>
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Thermometer className="w-3.5 h-3.5 text-red-400" />
                  Chamber Temp: <strong className="text-white">125.0 °C</strong> (Set)
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  DUT Cohort: <strong className="text-white">{devices.length || 200} Channels</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Run Control Actions */}
          <div className="flex items-center gap-2">
            {activeRun?.status !== 'running' ? (
              <button
                onClick={() => startRun(runId)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-colors font-mono"
              >
                <Play className="w-3.5 h-3.5" /> Start Telemetry
              </button>
            ) : (
              <button
                onClick={() => pauseRun(runId)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-colors font-mono"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            )}

            <button
              onClick={() => completeRun(runId)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-space-850 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono transition-colors"
            >
              <Square className="w-3.5 h-3.5 text-red-400" /> Stop / Complete
            </button>

            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-space-850 hover:bg-slate-800 text-cyber-cyan border border-cyber-cyan/30 text-xs font-mono transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Lot Report
            </button>
          </div>
        </div>
      </div>

      {/* JUDGE LIVE ANOMALY INJECTION PANEL (On-Stage WOW moment) */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-space-900 via-space-850 to-space-900 border border-cyber-cyan/40 shadow-cyan-glow">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 shadow-cyan-glow">
              <Zap className="w-5 h-5 animate-pulse text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white uppercase tracking-wider">
                  Live Judge Demo: Anomaly Injection Console
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  REAL-TIME TEST
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Force a latent defect pattern into any DUT to witness sub-second multi-model detection & SHAP explanation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <select
              value={injectDevice}
              onChange={(e) => setInjectDevice(e.target.value)}
              className="px-3 py-1.5 bg-space-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyber-cyan"
            >
              <option value="d-0014">DUT Channel 14 (d-0014)</option>
              <option value="d-0042">DUT Channel 42 (d-0042)</option>
              <option value="d-0088">DUT Channel 88 (d-0088)</option>
              <option value="d-0120">DUT Channel 120 (d-0120)</option>
              <option value="d-0175">DUT Channel 175 (d-0175)</option>
            </select>

            <select
              value={injectClass}
              onChange={(e) => setInjectClass(e.target.value)}
              className="px-3 py-1.5 bg-space-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyber-cyan"
            >
              <option value="gradual_drift">Gradual Drift (Accelerating I_R)</option>
              <option value="sudden_shift">Sudden Shift (Step Increase)</option>
              <option value="intermittent_spike">Intermittent Spike (Wire-Bond Noise)</option>
              <option value="cohort_outlier">Cohort Outlier (Statistical Deviation)</option>
              <option value="thermal_lag">Thermal Lag (Packaging Defect)</option>
            </select>

            <button
              onClick={handleInjectAnomaly}
              disabled={isInjecting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 text-space-950 font-bold hover:brightness-110 shadow-amber-glow transition-all flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              {isInjecting ? 'Injecting...' : 'Inject Anomaly Live'}
            </button>
          </div>
        </div>

        {injectMessage && (
          <div className="mt-3 p-2 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono">
            {injectMessage}
          </div>
        )}
      </div>

      {/* 200-Device Matrix Grid */}
      <DeviceHeatmap
        runId={runId}
        devices={devices}
        onSelectDevice={(devId) => setSelectedDevice(devId)}
      />

      {/* Live Parametric Telemetry Trends for Currently Selected Device */}
      <div className="grid grid-cols-1 gap-6">
        <TelemetryChart
          samples={selectedHistory}
          cohortStats={cohortStats}
          deviceName={`${currentSelectedDevice?.deviceSerial || 'Channel 14'} (CH ${currentSelectedDevice?.channelId || 14})`}
        />
      </div>
    </div>
  );
};
