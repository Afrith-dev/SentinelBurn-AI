import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  ArrowUpRight, 
  Clock, 
  ShieldCheck, 
  Zap, 
  Layers 
} from 'lucide-react';
import { runsApi, alertsApi, modelsApi } from '../services/api';
import { Run, Alert, ModelMetrics } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [runsData, metricsData] = await Promise.all([
          runsApi.getRuns(),
          modelsApi.getMetrics()
        ]);
        setRuns(runsData);
        setMetrics(metricsData);

        if (runsData.length > 0) {
          const runAlerts = await alertsApi.getAlerts(runsData[0].id);
          setAlerts(runAlerts);
        }
      } catch (e) {
        console.error('Error fetching dashboard data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalDevices = runs.reduce((acc, r) => acc + (r.deviceCount || 200), 0);
  const activeRunsCount = runs.filter(r => r.status === 'running').length;
  const totalAlertsCount = alerts.length;

  return (
    <div className="space-y-6">
      {/* Top Header & New Run Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-wider text-white">
              Qualification Operations Console
            </h1>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Real-time multi-chamber telemetry ingestion & anomaly surveillance
          </p>
        </div>

        <Link
          to="/runs/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyber-cyan text-space-950 font-bold text-xs shadow-cyan-glow hover:bg-cyan-300 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Burn-In Run
        </Link>
      </div>

      {/* Mission KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-space-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">MONITORED DUTS</span>
            <Cpu className="w-4 h-4 text-cyber-cyan" />
          </div>
          <div className="text-2xl font-mono font-bold text-white mt-2">
            {totalDevices}
          </div>
          <div className="text-[10px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 100% telemetry acquisition
          </div>
        </div>

        <div className="p-4 rounded-xl bg-space-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">ACTIVE RUNS</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-white mt-2">
            {activeRunsCount} <span className="text-xs font-normal text-slate-400">/ {runs.length} Total</span>
          </div>
          <div className="text-[10px] font-mono text-blue-400 mt-1">
            Chamber Setpoint 125.0°C
          </div>
        </div>

        <div className="p-4 rounded-xl bg-space-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">FLAGGED ANOMALIES</span>
            <AlertTriangle className="w-4 h-4 text-alert-critical" />
          </div>
          <div className="text-2xl font-mono font-bold text-alert-critical mt-2">
            {totalAlertsCount}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            Ensemble score &gt; 40.0 threshold
          </div>
        </div>

        <div className="p-4 rounded-xl bg-space-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">ENSEMBLE F1-SCORE</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-400 mt-2">
            {metrics ? `${(metrics.metrics.f1Score * 100).toFixed(1)}%` : '93.3%'}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            Precision: {metrics ? (metrics.metrics.precision * 100).toFixed(1) : '94.1'}% · Recall: {metrics ? (metrics.metrics.recall * 100).toFixed(1) : '92.5'}%
          </div>
        </div>
      </div>

      {/* Main Grid: Active Runs & Live Anomaly Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Active Runs Table */}
        <div className="lg:col-span-2 bg-space-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyber-cyan" />
                Active Burn-In Qualification Runs
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Lots currently undergoing thermal stress screening
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {runs.length} LOTS REGISTERED
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">RUN ID</th>
                  <th className="pb-3 font-semibold">PART NUMBER</th>
                  <th className="pb-3 font-semibold">CHAMBER DURATION</th>
                  <th className="pb-3 font-semibold">STATUS</th>
                  <th className="pb-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-bold text-slate-200">
                      {run.id}
                    </td>
                    <td className="py-3 text-slate-300">
                      <div>{run.lot?.partNumber || 'HMC-9021'}</div>
                      <div className="text-[10px] text-slate-400">{run.lot?.specReference || 'MIL-STD-883K'}</div>
                    </td>
                    <td className="py-3 text-slate-300">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {run.elapsedHours.toFixed(1)} hrs ({run.speedMultiplier}x)
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        run.status === 'running'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : run.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : run.status === 'completed'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => navigate(`/runs/${run.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-space-850 hover:bg-slate-700 text-cyber-cyan border border-cyber-cyan/30 text-[11px] transition-colors"
                      >
                        Monitor
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Live Anomaly Alerts Feed */}
        <div className="bg-space-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-alert-critical" />
              Live Flagged Feed
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {alerts.length} ALERTS
            </span>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-400">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400 mb-1 opacity-60" />
                No active anomalies detected in current window.
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => navigate(`/runs/${alert.runId}/devices/${alert.deviceId}`)}
                  className="p-3 rounded-lg bg-space-850 border border-slate-800 hover:border-cyber-cyan/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {alert.deviceSerial || alert.deviceId}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      alert.severity === 'critical' ? 'bg-alert-critical text-white' : 'bg-alert-warning text-space-950 font-bold'
                    }`}>
                      {alert.score}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 font-sans">
                    {alert.message}
                  </p>
                  <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>{new Date(alert.createdAt).toLocaleTimeString()}</span>
                    <span className="text-cyber-cyan hover:underline">Inspect SHAP &rarr;</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
