import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  ShieldCheck, 
  MessageSquare,
  Activity
} from 'lucide-react';
import { devicesApi, runsApi } from '../services/api';
import { Device, TelemetrySample, ShapExplanation, Disposition } from '../types';
import { TelemetryChart } from '../components/TelemetryChart';
import { ShapWaterfall } from '../components/ShapWaterfall';
import { useAuthStore } from '../store/authStore';

export const DeviceDeepDive: React.FC = () => {
  const { id: runId, deviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [device, setDevice] = useState<Device | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySample[]>([]);
  const [explanation, setExplanation] = useState<ShapExplanation | null>(null);
  const [loading, setLoading] = useState(true);

  // Disposition form state
  const [decision, setDecision] = useState<'accept' | 'reject' | 'hold_fa'>('reject');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!runId || !deviceId) return;

    const fetchDeepDiveData = async () => {
      try {
        const [devData, telemData, explainData] = await Promise.all([
          devicesApi.getDevice(runId, deviceId),
          devicesApi.getTelemetry(runId, deviceId),
          devicesApi.getExplanation(runId, deviceId)
        ]);
        setDevice(devData);
        setTelemetry(telemData);
        setExplanation(explainData);
        if (devData.disposition) {
          setDecision(devData.disposition.decision);
          setComment(devData.disposition.comment || '');
        }
      } catch (err) {
        console.error('Error fetching device deep dive:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeepDiveData();
  }, [runId, deviceId]);

  const handleDispositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId || !runId) return;

    setIsSubmitting(true);
    try {
      const res = await devicesApi.setDisposition(deviceId, {
        runId,
        decision,
        comment
      });

      setSuccessMsg(`✓ Disposition [${decision.toUpperCase()}] committed to append-only SHA-256 audit ledger!`);
      if (device) {
        setDevice({ ...device, disposition: res.disposition });
      }
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Failed to submit disposition:', err);
      alert('Failed to record disposition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const score = device?.latestScores?.ensembleScore ?? 78.0;
  const isCritical = score >= 65.0;
  const isWarning = score >= 40.0 && score < 65.0;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Return */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/runs/${runId}`)}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Live Matrix Monitor
        </button>

        <span className="text-xs font-mono text-slate-400">
          Run: <strong className="text-slate-200">{runId}</strong>
        </span>
      </div>

      {/* Device Header Banner */}
      <div className="bg-space-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${
              isCritical
                ? 'bg-alert-critical/20 text-alert-critical border-alert-critical/40 shadow-crimson-glow animate-pulse'
                : isWarning
                ? 'bg-alert-warning/20 text-alert-warning border-alert-warning/40 shadow-amber-glow'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}>
              <Cpu className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white font-mono">
                  {device?.deviceSerial || `HMC-2026-${deviceId}`}
                </h1>
                <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-space-850 text-cyber-cyan border border-cyber-cyan/30">
                  CHANNEL {device?.channelId || 14}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                  isCritical
                    ? 'bg-alert-critical text-white'
                    : isWarning
                    ? 'bg-alert-warning text-space-950'
                    : 'bg-emerald-600 text-white'
                }`}>
                  Anomaly Score: {score}% ({device?.latestScores?.severity || 'critical'})
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1">
                ISRO Space-Grade Qualification · MIL-STD-883K Method 1015 Parametric Drift Analysis
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-space-850 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">VOLTAGE</span>
              <span className="text-slate-100 font-bold">{device?.latestReadings?.voltage?.toFixed(3) || '5.012'} V</span>
            </div>
            <div className="p-2.5 rounded-lg bg-space-850 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">CURRENT</span>
              <span className="text-slate-100 font-bold">{device?.latestReadings?.current?.toFixed(3) || '0.182'} A</span>
            </div>
            <div className="p-2.5 rounded-lg bg-space-850 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">LEAKAGE I_R</span>
              <span className="text-amber-400 font-bold">
                {device?.latestReadings ? (device.latestReadings.leakageCurrent * 1000).toFixed(2) + ' µA' : '3.45 µA'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-space-850 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">TEMP</span>
              <span className="text-slate-100 font-bold">{device?.latestReadings?.temperature?.toFixed(1) || '125.2'} °C</span>
            </div>
          </div>
        </div>

        {/* Multi-Model Ensemble Score Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-800 text-xs font-mono">
          <div className="p-3 rounded-lg bg-space-950/60 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400">
              <span>POINT ANOMALY (ISOLATION FOREST)</span>
              <span className="text-cyber-cyan font-bold">{((device?.latestScores?.pointScore || 0.45) * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-space-850 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-cyber-cyan" style={{ width: `${(device?.latestScores?.pointScore || 0.45) * 100}%` }} />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-space-950/60 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400">
              <span>DRIFT ANOMALY (STL + MANN-KENDALL)</span>
              <span className="text-amber-400 font-bold">{((device?.latestScores?.driftScore || 0.88) * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-space-850 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-amber-400" style={{ width: `${(device?.latestScores?.driftScore || 0.88) * 100}%` }} />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-space-950/60 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400">
              <span>SEQUENCE ERROR (AUTOENCODER MSE)</span>
              <span className="text-red-400 font-bold">{((device?.latestScores?.sequenceScore || 0.65) * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-space-850 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-red-400" style={{ width: `${(device?.latestScores?.sequenceScore || 0.65) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Telemetry Trends & SHAP Explainability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Parametric Telemetry Curves */}
        <TelemetryChart
          samples={telemetry}
          deviceName={`${device?.deviceSerial || deviceId}`}
        />

        {/* Right: SHAP Waterfall Explainability Panel */}
        <ShapWaterfall
          explanation={explanation}
          anomalyClass={device?.latestScores?.anomalyClassGuess || 'gradual_drift'}
          score={score}
        />
      </div>

      {/* Official Engineer Disposition & Audit Trail Sign-off */}
      <div className="bg-space-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Quality Engineer Disposition & Tamper-Evident Sign-Off
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Current User: <strong className="text-slate-200">{user?.name}</strong> ({user?.role})
          </span>
        </div>

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleDispositionSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-300 mb-2 font-semibold">
              FLIGHT HARDWARE DISPOSITION DECISION:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                decision === 'reject'
                  ? 'bg-alert-critical/20 border-alert-critical text-white shadow-crimson-glow font-bold'
                  : 'bg-space-850 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="decision"
                  value="reject"
                  checked={decision === 'reject'}
                  onChange={() => setDecision('reject')}
                  className="text-alert-critical focus:ring-0"
                />
                <XCircle className="w-4 h-4 text-alert-critical" />
                REJECT (Defective Unit)
              </label>

              <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                decision === 'hold_fa'
                  ? 'bg-alert-warning/20 border-alert-warning text-white shadow-amber-glow font-bold'
                  : 'bg-space-850 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="decision"
                  value="hold_fa"
                  checked={decision === 'hold_fa'}
                  onChange={() => setDecision('hold_fa')}
                  className="text-alert-warning focus:ring-0"
                />
                <AlertTriangle className="w-4 h-4 text-alert-warning" />
                HOLD FOR FA (Failure Analysis)
              </label>

              <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                decision === 'accept'
                  ? 'bg-emerald-500/20 border-emerald-400 text-white font-bold'
                  : 'bg-space-850 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="decision"
                  value="accept"
                  checked={decision === 'accept'}
                  onChange={() => setDecision('accept')}
                  className="text-emerald-400 focus:ring-0"
                />
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ACCEPT (Flight Qualified)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1.5 font-semibold">
              ENGINEER FAILURE ANALYSIS OBSERVATIONS / AUDIT JUSTIFICATION:
            </label>
            <textarea
              rows={3}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Non-linear accelerating leakage current observed in Channel 14 at Hour 26.4. Rejection justified per ISRO-PAS-206 section 4.3.2 due to thermal runaway precursor."
              className="w-full p-3 bg-space-850 border border-slate-700 rounded-lg text-slate-100 font-sans focus:outline-none focus:border-cyber-cyan text-xs leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg bg-cyber-cyan text-space-950 font-bold hover:bg-cyan-300 transition-colors shadow-cyan-glow flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {isSubmitting ? 'Hashing & Committing to Ledger...' : 'Commit Disposition to Cryptographic Audit Chain'}
          </button>
        </form>
      </div>
    </div>
  );
};
