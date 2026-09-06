import React, { useEffect, useState } from 'react';
import {
  Microscope,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Wrench,
  Search,
  Sparkles,
  Layers,
  ChevronRight,
  Send,
  RefreshCw,
} from 'lucide-react';
import { devicesApi, runsApi } from '../services/api';
import { Device, Run } from '../types';
import { useAuthStore } from '../store/authStore';

const MECHANISMS = [
  'Electromigration (Al-Cu voiding)',
  'Dielectric Breakdown / Oxide Degradation',
  'Electrostatic Discharge (ESD Damage)',
  'Hot-Carrier Injection (HCI)',
  'Parametric Thermal Drift',
  'Wire-Bond / Delamination Void',
  'Latch-up Induced Current Crowding',
  'Packaging Hermetic Seal Failure',
  'Unknown / Needs Focused Ion Beam (FIB)',
];

export const FADashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [holdList, setHoldList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // FA investigation form state
  const [mechanism, setMechanism] = useState(MECHANISMS[0]);
  const [evidence, setEvidence] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [resolution, setResolution] = useState<'reject' | 'pass'>('reject');

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const data = await devicesApi.getHoldFADevices();
      setHoldList(data);
      if (data.length > 0 && !selectedItem) {
        setSelectedItem(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch FA queue', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleCompleteFA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !evidence.trim()) return;

    try {
      setSaving(true);
      const deviceId = selectedItem.id || selectedItem.device?.id;
      const runId = selectedItem.device?.runId || 'run-default-01';

      const comment = `[FA Lead: ${user?.personaName || 'Dr. Balaji'}] Mechanism: ${mechanism} | Evidence: ${evidence.trim()} | Action: ${correctiveAction.trim() || 'N/A'} | FA Status: RESOLVED`;

      await devicesApi.setDisposition(deviceId, {
        runId,
        decision: resolution,
        comment,
      });

      setMsg(`Device ${selectedItem.device?.deviceSerial || deviceId} marked FA Complete (${resolution.toUpperCase()}).`);
      setEvidence('');
      setCorrectiveAction('');
      await fetchQueue();
      setSelectedItem(null);
      setTimeout(() => setMsg(''), 4000);
    } catch (err: any) {
      alert('Failed to record FA resolution: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-950/40 via-surface-card to-rose-950/20 border border-rose-500/30 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Microscope className="w-6 h-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Failure Analysis (FA) & Diagnostic Lab
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                {user?.personaName || 'Dr. Balaji'} (FA Lead)
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Root-cause de-encapsulation, electrical overstress analysis, and physical teardown investigation.
            </p>
          </div>
        </div>

        <button
          onClick={fetchQueue}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Queue
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {msg}
        </div>
      )}

      {/* Main Grid: Left Queue, Right Root-Cause Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Hold for FA Device List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface-card border border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-rose-400" />
                Quarantine / FA Queue
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold">
                {holdList.length} DUTs
              </span>
            </div>

            {loading ? (
              <p className="text-xs text-slate-500 py-6 text-center">Loading quarantined devices...</p>
            ) : holdList.length === 0 ? (
              <div className="text-center py-8 px-4 text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                No devices currently on Hold for FA. All lots operating within nominal parametric margins.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {holdList.map((item, idx) => {
                  const dev = item.device;
                  const isSelected = (selectedItem?.id || selectedItem?.device?.id) === (item.id || dev?.id);
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-rose-500/15 border-rose-500/40 text-white'
                          : 'bg-surface-elevated/70 border-white/5 text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-mono text-xs font-bold text-white">
                          {dev?.deviceSerial || item.id}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Channel {dev?.channelId || 'N/A'} • {item.disposition?.comment || 'QA Hold Flag'}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-rose-400' : 'text-slate-600'}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Root-Cause Investigation Workspace */}
        <div className="lg:col-span-8">
          <div className="bg-surface-card border border-white/5 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-rose-400" />
                Root-Cause Diagnostic Workspace
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Investigate microscopic failure signature, record metallurgical findings, and complete the flight disposition.
              </p>
            </div>

            {selectedItem ? (
              <form onSubmit={handleCompleteFA} className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-surface-elevated border border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] block">DUT Serial</span>
                    <strong className="text-white text-sm">
                      {selectedItem.device?.deviceSerial || selectedItem.id}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] block">Test Channel</span>
                    <span className="text-slate-300">CH-{selectedItem.device?.channelId || '01'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] block">Baseline Nominal</span>
                    <span className="text-slate-300">5.0V / 180mA</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] block">QA Initial Note</span>
                    <span className="text-amber-400 truncate block" title={selectedItem.disposition?.comment}>
                      {selectedItem.disposition?.comment || 'Quarantined'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Suspected Physical Failure Mechanism *
                  </label>
                  <select
                    value={mechanism}
                    onChange={(e) => setMechanism(e.target.value)}
                    className="w-full bg-surface-elevated border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-rose-500"
                  >
                    {MECHANISMS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Microscopic / SEM / X-Ray Evidence & Electrical Signature *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    placeholder="Describe SEM imaging results, pinhole coordinates, C-SAM acoustic microscopy acoustic delamination, or I-V curve breakdown..."
                    className="w-full bg-surface-elevated border border-white/10 rounded-lg p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Corrective & Preventative Action (CAPA)
                  </label>
                  <textarea
                    rows={2}
                    value={correctiveAction}
                    onChange={(e) => setCorrectiveAction(e.target.value)}
                    placeholder="Recommend fab passivation tweaks, wire-bond clamping adjustments, or wafer screening limits..."
                    className="w-full bg-surface-elevated border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Final Disposition Decision
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setResolution('reject')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                        resolution === 'reject'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                          : 'bg-surface-elevated border-white/5 text-slate-400'
                      }`}
                    >
                      Permanent Flight Reject (Scrap / Museum)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolution('pass')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                        resolution === 'pass'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-surface-elevated border-white/5 text-slate-400'
                      }`}
                    >
                      Clear DUT (False Alarm / Retest Passed)
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-white/5">
                  <button
                    type="submit"
                    disabled={saving || !evidence.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-600/30"
                  >
                    <Send className="w-4 h-4" />
                    {saving ? 'Recording FA...' : 'Mark FA Investigation Complete'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-16 text-center text-slate-500 text-xs">
                Select a device from the quarantine queue to begin failure analysis teardown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
