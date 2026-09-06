import React, { useEffect, useState, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  AlertOctagon,
  Clock,
  CheckCircle2,
  FileText,
  UserCheck,
  Radio,
  Send,
  RefreshCw,
  LogOut,
  Flame,
} from 'lucide-react';
import { runsApi, alertsApi, operatorApi } from '../services/api';
import { Run, Alert } from '../types';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export const OperatorDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 15-minute inactivity auto-logout timer
  const idleTimerRef = useRef<any>(null);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    // 15 minutes = 15 * 60 * 1000 ms
    idleTimerRef.current = setTimeout(() => {
      logout();
      navigate('/floor-login');
    }, 15 * 60 * 1000);
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const runsList = await runsApi.getRuns();
      // Pick first active or most recent run
      const run = runsList.find((r: Run) => r.status === 'running') || runsList[0] || null;
      setActiveRun(run);

      if (run) {
        const [alertList, shiftNotes] = await Promise.all([
          alertsApi.getAlerts(run.id).catch(() => []),
          operatorApi.getShiftNotes(run.id).catch(() => []),
        ]);
        setAlerts(alertList);
        setNotes(shiftNotes);
      }
    } catch (err) {
      console.error('Failed to load operator data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    if (!activeRun) return;
    try {
      setBtnLoading(true);
      await runsApi.startRun(activeRun.id);
      setMsg('Chamber run resumed / started successfully.');
      await loadData();
    } catch (err: any) {
      alert('Start failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setBtnLoading(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handlePause = async () => {
    if (!activeRun) return;
    try {
      setBtnLoading(true);
      await runsApi.pauseRun(activeRun.id);
      setMsg('Chamber run paused. Telemetry frozen.');
      await loadData();
    } catch (err: any) {
      alert('Pause failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setBtnLoading(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handleStop = async () => {
    if (!activeRun) return;
    if (!window.confirm('Are you sure you want to stop/complete this thermal qualification run?')) return;
    try {
      setBtnLoading(true);
      await runsApi.completeRun(activeRun.id);
      setMsg('Chamber run completed.');
      await loadData();
    } catch (err: any) {
      alert('Complete failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setBtnLoading(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await alertsApi.acknowledgeAlert(alertId);
      setMsg('Alarm acknowledged by Floor Operator.');
      if (activeRun) {
        const updated = await alertsApi.getAlerts(activeRun.id);
        setAlerts(updated);
      }
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error('Failed to ack alert', err);
    }
  };

  const handleAddShiftNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !activeRun) return;

    try {
      await operatorApi.saveShiftNote({
        runId: activeRun.id,
        note: newNote.trim(),
        author: user?.name || 'Floor Operator',
      });
      setNewNote('');
      const updatedNotes = await operatorApi.getShiftNotes(activeRun.id);
      setNotes(updatedNotes);
      setMsg('Shift handover note recorded.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      alert('Failed to save shift note: ' + (err.response?.data?.error || err.message));
    }
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledgedBy);

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* High-visibility Floor Terminal Header */}
      <div className="bg-gradient-to-r from-amber-950/40 via-surface-card to-amber-950/20 border-2 border-amber-500/40 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Flame className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                Cleanroom Floor Terminal
              </h1>
              <span className="px-3 py-1 bg-amber-500 text-black text-xs font-extrabold rounded-md uppercase tracking-wider">
                DUT BAY 04
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 font-mono">
              Operator: <strong className="text-amber-400">{user?.name || 'Floor Operator'}</strong> | 15-min auto-lock active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-3 bg-surface-elevated hover:bg-white/10 text-white rounded-xl border border-white/10"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/floor-login');
            }}
            className="flex items-center gap-2 px-4 py-3 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 rounded-xl text-sm font-bold"
          >
            <LogOut className="w-4 h-4" />
            Lock Terminal
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 px-5 py-3 rounded-xl flex items-center gap-3 font-semibold text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {msg}
        </div>
      )}

      {/* Critical Alarm Banner (Floor Visibility) */}
      {criticalAlerts.length > 0 && (
        <div className="bg-rose-600/20 border-2 border-rose-500 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-8 h-8 text-rose-400 flex-shrink-0" />
            <div>
              <div className="text-rose-300 font-extrabold text-base tracking-wide uppercase">
                CRITICAL CHAMBER ALARM ({criticalAlerts.length} ACTIVE)
              </div>
              <p className="text-white text-sm font-medium mt-0.5">
                {criticalAlerts[0].message || 'Abnormal thermal spike detected on DUT bus.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleAcknowledgeAlert(criticalAlerts[0].id)}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white text-sm font-extrabold uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/40 transition-colors whitespace-nowrap"
          >
            Acknowledge Alarm
          </button>
        </div>
      )}

      {/* Chamber Status Card with Large-Touch Buttons */}
      <div className="bg-surface-card border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Active Burn-In Chamber Run</span>
            <h2 className="text-2xl font-bold text-white mt-1">
              {activeRun ? activeRun.lot?.partNumber || `Run ${activeRun.id.slice(0, 8)}` : 'No Active Chamber Run'}
            </h2>
          </div>
          {activeRun && (
            <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 rounded-full text-sm font-black tracking-wider uppercase border ${
                activeRun.status === 'running'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                  : activeRun.status === 'paused'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-500/20 text-slate-400 border-slate-500/40'
              }`}>
                ● {activeRun.status}
              </span>
              <span className="text-xs font-mono text-slate-400 bg-surface-elevated px-3 py-1.5 rounded-lg border border-white/5">
                {activeRun.speedMultiplier}x Accel
              </span>
            </div>
          )}
        </div>

        {/* Large Telemetry KPIs for High Readability */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-elevated p-4 rounded-xl border border-white/5">
            <span className="text-xs text-slate-400 uppercase font-semibold">Chamber Setpoint</span>
            <div className="text-3xl font-black text-amber-400 mt-1 font-mono">125.0°C</div>
            <span className="text-[11px] text-slate-500">Thermal soak nominal</span>
          </div>
          <div className="bg-surface-elevated p-4 rounded-xl border border-white/5">
            <span className="text-xs text-slate-400 uppercase font-semibold">Elapsed Hours</span>
            <div className="text-3xl font-black text-white mt-1 font-mono">
              {activeRun ? `${activeRun.elapsedHours.toFixed(1)}h` : '0.0h'}
            </div>
            <span className="text-[11px] text-slate-500">Target: 168.0h qualification</span>
          </div>
          <div className="bg-surface-elevated p-4 rounded-xl border border-white/5">
            <span className="text-xs text-slate-400 uppercase font-semibold">Active DUTs</span>
            <div className="text-3xl font-black text-emerald-400 mt-1 font-mono">200 / 200</div>
            <span className="text-[11px] text-slate-500">All channels energized</span>
          </div>
          <div className="bg-surface-elevated p-4 rounded-xl border border-white/5">
            <span className="text-xs text-slate-400 uppercase font-semibold">Supply Bus</span>
            <div className="text-3xl font-black text-white mt-1 font-mono">5.01 V</div>
            <span className="text-[11px] text-slate-500">Ripple: &lt; 8mV RMS</span>
          </div>
        </div>

        {/* Massive Touch-Friendly Chamber Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <button
            disabled={btnLoading || !activeRun || activeRun.status === 'running'}
            onClick={handleStart}
            className="flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-base uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98]"
          >
            <Play className="w-6 h-6 fill-current" />
            Start / Resume
          </button>

          <button
            disabled={btnLoading || !activeRun || activeRun.status === 'paused'}
            onClick={handlePause}
            className="flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-extrabold text-base uppercase tracking-wider shadow-lg shadow-amber-600/30 transition-all active:scale-[0.98]"
          >
            <Pause className="w-6 h-6 fill-current" />
            Pause Chamber
          </button>

          <button
            disabled={btnLoading || !activeRun || activeRun.status === 'completed'}
            onClick={handleStop}
            className="flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-extrabold text-base uppercase tracking-wider shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98]"
          >
            <Square className="w-6 h-6 fill-current" />
            End Run
          </button>
        </div>
      </div>

      {/* Shift Handover Log & Submission */}
      <div className="bg-surface-card border border-white/10 rounded-2xl p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            Shift Handover & Facility Logbook
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Log cleanroom atmosphere changes, LN2 top-up, chamber seal inspections, or duty operator turnover.
          </p>
        </div>

        <form onSubmit={handleAddShiftNote} className="space-y-3">
          <textarea
            required
            rows={2}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter shift handover notes, chamber inspection comments, or visual inspection flags..."
            className="w-full bg-surface-elevated border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newNote.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
              Save Handover Note
            </button>
          </div>
        </form>

        {/* Existing Notes Feed */}
        <div className="space-y-3 pt-2">
          {notes.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No notes recorded for this shift yet.</p>
          ) : (
            notes.map((n: any) => (
              <div key={n.id} className="p-4 rounded-xl bg-surface-elevated/70 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    {n.author}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(n.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-200">{n.note}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
