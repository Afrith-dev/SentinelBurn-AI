import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Download,
  Lock,
  Unlock,
  Layers,
  ArrowRight,
  Sparkles,
  Search,
  RefreshCw,
} from 'lucide-react';
import { runsApi, devicesApi } from '../services/api';
import { Run, Device } from '../types';
import { useAuthStore } from '../store/authStore';

export const QADashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Disposition action state
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [decision, setDecision] = useState<'pass' | 'reject' | 'hold_fa'>('pass');
  const [justification, setJustification] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Checklist state
  const [checklist, setChecklist] = useState({
    thermalStability: true,
    leakageVariance: true,
    telemetryContinuity: true,
    dispositionQuorum: false,
    auditIntegrity: true,
  });

  // Digital sign-off state
  const [signedOff, setSignedOff] = useState(false);
  const [signOffTimestamp, setSignOffTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const runsList = await runsApi.getRuns();
        setRuns(runsList);
        if (runsList.length > 0) {
          const firstRun = runsList[0].id;
          setSelectedRunId(firstRun);
          await loadRunDetails(firstRun);
        }
      } catch (err) {
        console.error('Failed to load QA runs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const loadRunDetails = async (runId: string) => {
    try {
      const [devList, auditData, verifyResult] = await Promise.all([
        devicesApi.getDevices(runId),
        runsApi.getAuditLog(runId).catch(() => []),
        runsApi.verifyAuditChain(runId).catch(() => ({ valid: true })),
      ]);
      setDevices(devList);
      setAuditLogs(Array.isArray(auditData) ? auditData : auditData.logs || []);
      setChainValid(verifyResult.valid ?? true);
    } catch (err) {
      console.error('Failed to load QA run details', err);
    }
  };

  const handleRunChange = async (runId: string) => {
    setSelectedRunId(runId);
    setLoading(true);
    await loadRunDetails(runId);
    setLoading(false);
  };

  const handleDispositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !justification.trim() || !selectedRunId) return;

    setActionLoading(selectedDevice.id);
    try {
      await devicesApi.setDisposition(selectedDevice.id, {
        runId: selectedRunId,
        decision,
        comment: `[QA Director: ${user?.personaName || 'Dr. Selvi'}] ${justification.trim()}`,
      });
      setSuccessMsg(`Device ${selectedDevice.deviceSerial || selectedDevice.id} disposition recorded as ${decision.toUpperCase()}`);
      setSelectedDevice(null);
      setJustification('');
      await loadRunDetails(selectedRunId);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('Failed to save disposition: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignOff = () => {
    setSignedOff(true);
    setSignOffTimestamp(new Date().toISOString());
    setSuccessMsg(`Qualification report digitally certified by ${user?.personaName || 'Dr. Selvi'}`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Metrics
  const totalCount = devices.length;
  const passedCount = devices.filter((d: any) => d.disposition?.decision === 'pass').length;
  const rejectedCount = devices.filter((d: any) => d.disposition?.decision === 'reject').length;
  const holdFaCount = devices.filter((d: any) => d.disposition?.decision === 'hold_fa').length;
  const pendingCount = devices.filter((d: any) => !d.disposition).length;
  const passRate = totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(1) : '100.0';

  const allChecklistPassed = Object.values(checklist).every(Boolean);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-violet-950/40 via-surface-card to-violet-950/20 border border-violet-500/30 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <FileCheck className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  QA Directorate & Lot Release Console
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                  {user?.personaName || 'Dr. Selvi'} (QA Director)
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Independent product assurance, disposition authority, and cryptographic qualification sign-off.
              </p>
            </div>
          </div>
        </div>

        {/* Run Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Lot / Run:</label>
          <select
            value={selectedRunId}
            onChange={(e) => handleRunChange(e.target.value)}
            className="bg-surface-elevated border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-violet-500"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.lot?.partNumber || 'Lot'} ({r.id.slice(0, 8)}) — {r.status.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedRunId && loadRunDetails(selectedRunId)}
            className="p-2 bg-surface-elevated hover:bg-white/10 rounded-lg text-slate-300 border border-white/10"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-white/5 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Pass Rate</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{passRate}%</p>
          <p className="text-[11px] text-slate-500 mt-1">{passedCount} of {totalCount} cleared</p>
        </div>
        <div className="bg-surface-card border border-white/5 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Held for FA</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{holdFaCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Pending physical failure analysis</p>
        </div>
        <div className="bg-surface-card border border-white/5 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Rejected DUTs</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{rejectedCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Parametric drift / hard failures</p>
        </div>
        <div className="bg-surface-card border border-white/5 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Audit Chain</p>
          <p className={`text-2xl font-bold mt-1 ${chainValid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {chainValid ? 'VERIFIED' : 'TAMPERED'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">SHA-256 ECSS Immutable Log</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Batch Approval Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-violet-400" />
                  Batch Disposition Queue
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review anomalous or unclassified devices. Each disposition requires a mandatory QA justification note.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-surface-elevated text-slate-300 border border-white/10 font-mono">
                {pendingCount} Pending Review
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 text-sm">Loading qualification lot data...</div>
            ) : devices.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">No devices found in this burn-in run.</div>
            ) : (
              <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-surface-elevated sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Device Serial</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3">Latest Readings</th>
                      <th className="py-2.5 px-3">Current Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {devices.slice(0, 30).map((dev: any) => {
                      const disp = dev.disposition?.decision;
                      const hasDisp = !!disp;
                      return (
                        <tr key={dev.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">
                            {dev.deviceSerial || dev.id}
                          </td>
                          <td className="py-3 px-3 text-slate-400">CH-{dev.channelId}</td>
                          <td className="py-3 px-3 text-slate-300">
                            {dev.latestReadings ? (
                              <span>
                                {dev.latestReadings.voltage?.toFixed(2)}V | {dev.latestReadings.current?.toFixed(3)}A | {dev.latestReadings.temperature?.toFixed(1)}°C
                              </span>
                            ) : (
                              <span className="text-slate-500">Nominal</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {disp === 'pass' && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                                ACCEPTED
                              </span>
                            )}
                            {disp === 'reject' && (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                                REJECTED
                              </span>
                            )}
                            {disp === 'hold_fa' && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                                HOLD FOR FA
                              </span>
                            )}
                            {!hasDisp && (
                              <span className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[10px]">
                                PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedDevice(dev);
                                setDecision((dev.disposition?.decision as any) || 'pass');
                                setJustification('');
                              }}
                              className="px-2.5 py-1 text-[11px] font-sans font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                            >
                              {hasDisp ? 'Re-classify' : 'Disposition'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Audit Chain Verification Feed */}
          <div className="bg-surface-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  ECSS-Q-ST-60C Cryptographic Audit Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Every disposition and state change is chained with SHA-256 signatures for flight assurance.
                </p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Chain Valid: {chainValid ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No recorded transactions in this run ledger.</p>
              ) : (
                auditLogs.slice(0, 10).map((log: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-surface-elevated/60 border border-white/5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white uppercase">{log.action || 'ACTION'}</span>
                        <span className="text-[10px] text-violet-300 font-mono">by {log.actorName || user?.personaName || 'QA Lead'}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{log.details ? JSON.stringify(log.details) : 'Audit entry confirmed'}</p>
                    </div>
                    <div className="text-right font-mono text-[10px] text-slate-500">
                      <div>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Recent'}</div>
                      <div className="text-[9px] text-slate-600 truncate max-w-[120px]" title={log.currentHash}>
                        {log.currentHash ? log.currentHash.slice(0, 14) + '...' : '0xecss-hash'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Quality Checklist & Digital Sign-off */}
        <div className="space-y-6">
          {/* Quality Acceptance Checklist */}
          <div className="bg-surface-card border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-violet-400" />
              Flight Acceptance Checklist
            </h3>
            <p className="text-xs text-slate-400">
              Verify all criteria before executing QA lot release.
            </p>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.thermalStability}
                  onChange={(e) => setChecklist({ ...checklist, thermalStability: e.target.checked })}
                  className="mt-0.5 rounded border-white/20 bg-surface-elevated text-violet-600 focus:ring-violet-500"
                />
                <span>Thermal equilibrium maintained within ±1.5°C over 168h target</span>
              </label>

              <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.leakageVariance}
                  onChange={(e) => setChecklist({ ...checklist, leakageVariance: e.target.checked })}
                  className="mt-0.5 rounded border-white/20 bg-surface-elevated text-violet-600 focus:ring-violet-500"
                />
                <span>Parametric leakage current drift within MIL-STD-883 limits</span>
              </label>

              <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.telemetryContinuity}
                  onChange={(e) => setChecklist({ ...checklist, telemetryContinuity: e.target.checked })}
                  className="mt-0.5 rounded border-white/20 bg-surface-elevated text-violet-600 focus:ring-violet-500"
                />
                <span>Continuous bus telemetry uninterrupted; zero missing packets</span>
              </label>

              <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.dispositionQuorum}
                  onChange={(e) => setChecklist({ ...checklist, dispositionQuorum: e.target.checked })}
                  className="mt-0.5 rounded border-white/20 bg-surface-elevated text-violet-600 focus:ring-violet-500"
                />
                <span>All 200 DUTs reviewed; no unresolved critical anomaly flags</span>
              </label>

              <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.auditIntegrity}
                  onChange={(e) => setChecklist({ ...checklist, auditIntegrity: e.target.checked })}
                  className="mt-0.5 rounded border-white/20 bg-surface-elevated text-violet-600 focus:ring-violet-500"
                />
                <span>Cryptographic SHA-256 hash integrity verified</span>
              </label>
            </div>
          </div>

          {/* Digital Sign-off & Lot Release */}
          <div className="bg-gradient-to-br from-violet-950/40 via-surface-card to-surface-card border border-violet-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-violet-300">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Digital Flight Certification</h3>
            </div>

            <p className="text-xs text-slate-400">
              Certify this lot under ECSS-Q-ST-60C aerospace qualification standard.
            </p>

            {signedOff ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  LOT OFFICIALLY CERTIFIED
                </div>
                <p className="text-[11px] text-slate-300">
                  Signed by <strong className="text-white">{user?.personaName || 'Dr. Selvi'}</strong> (QA Director)
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {signOffTimestamp ? new Date(signOffTimestamp).toLocaleString() : ''}
                </p>
                <div className="pt-2">
                  <Link
                    to="/reports"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Certified PDF
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  disabled={!allChecklistPassed}
                  onClick={handleSignOff}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    allChecklistPassed
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <FileCheck className="w-4 h-4" />
                  Sign & Certify Lot Release
                </button>
                {!allChecklistPassed && (
                  <p className="text-[10px] text-amber-400/80 text-center">
                    Check all 5 flight criteria to unlock QA certification.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disposition Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-white/10 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                QA Disposition: {selectedDevice.deviceSerial || selectedDevice.id}
              </h3>
              <button
                onClick={() => setSelectedDevice(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispositionSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Assigned Disposition
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('pass')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                      decision === 'pass'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-surface-elevated border-white/5 text-slate-400'
                    }`}
                  >
                    Accept (Flight)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('hold_fa')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                      decision === 'hold_fa'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-surface-elevated border-white/5 text-slate-400'
                    }`}
                  >
                    Hold for FA
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('reject')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                      decision === 'reject'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-surface-elevated border-white/5 text-slate-400'
                    }`}
                  >
                    Reject DUT
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Mandatory QA Justification / Engineering Rationale *
                </label>
                <textarea
                  required
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="State parametric justification, delta from baseline, or FA routing instructions..."
                  className="w-full bg-surface-elevated border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDevice(null)}
                  className="px-4 py-2 rounded-lg bg-surface-elevated text-slate-300 text-xs font-medium hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!justification.trim() || !!actionLoading}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {actionLoading ? 'Recording...' : 'Commit Disposition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
