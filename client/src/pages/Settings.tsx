import React, { useState } from 'react';
import { 
  Sliders, 
  ShieldCheck, 
  Save, 
  RotateCcw, 
  Cpu, 
  Layers, 
  Thermometer, 
  Activity, 
  CheckCircle2 
} from 'lucide-react';

export const Settings: React.FC = () => {
  // Threshold settings
  const [warningThreshold, setWarningThreshold] = useState(40);
  const [criticalThreshold, setCriticalThreshold] = useState(65);

  // Ensemble model weight settings
  const [pointWeight, setPointWeight] = useState(0.35);
  const [driftWeight, setDriftWeight] = useState(0.40);
  const [sequenceWeight, setSequenceWeight] = useState(0.25);

  // Nominal Chamber Specs
  const [nominalVoltage, setNominalVoltage] = useState(5.0);
  const [nominalCurrent, setNominalCurrent] = useState(0.18);
  const [nominalLeakage, setNominalLeakage] = useState(2.5);
  const [chamberSetpoint, setChamberSetpoint] = useState(125.0);

  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('✓ System screening thresholds and ensemble fusion weights saved successfully!');
    setTimeout(() => setSavedMsg(null), 5000);
  };

  const handleReset = () => {
    setWarningThreshold(40);
    setCriticalThreshold(65);
    setPointWeight(0.35);
    setDriftWeight(0.40);
    setSequenceWeight(0.25);
    setNominalVoltage(5.0);
    setNominalCurrent(0.18);
    setNominalLeakage(2.5);
    setChamberSetpoint(125.0);
    setSavedMsg('Settings reset to MIL-STD-883K Method 1015 defaults.');
    setTimeout(() => setSavedMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyber-cyan" />
            <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-wider text-white">
              Qualification Engine & Threshold Settings
            </h1>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Configure multi-model ensemble weights, alert trigger boundaries, and chamber baselines
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-space-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-mono flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {savedMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Anomaly Severity Thresholds Card */}
        <div className="p-5 rounded-xl bg-space-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Activity className="w-4 h-4 text-cyber-cyan" />
            <h2 className="text-sm font-mono font-bold uppercase text-white">
              Anomaly Confidence Score Trigger Thresholds (0–100)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-amber-400 font-bold">WARNING THRESHOLD</span>
                <span className="text-white font-bold">{warningThreshold}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(Number(e.target.value))}
                className="w-full h-2 bg-space-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                Generates amber warning flags on the mission console; queues DUT for early engineer monitoring.
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-rose-400 font-bold">CRITICAL THRESHOLD</span>
                <span className="text-white font-bold">{criticalThreshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                className="w-full h-2 bg-space-950 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                Forces visual and audible alerts; mandates immediate Reliability Lead disposition.
              </p>
            </div>
          </div>
        </div>

        {/* Ensemble Model Fusion Weights */}
        <div className="p-5 rounded-xl bg-space-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-mono font-bold uppercase text-white">
              Multi-Model Ensemble Fusion Weights
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-slate-300">POINT ANOMALY (ISO FOREST)</span>
                <span className="text-cyber-cyan font-bold">{pointWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={pointWeight}
                onChange={(e) => setPointWeight(Number(e.target.value))}
                className="w-full h-2 bg-space-950 rounded-lg appearance-none cursor-pointer accent-cyber-cyan"
              />
              <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                Weight for instantaneous multivariate spikes and sudden shifts.
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-slate-300">DRIFT & TREND (MANN-KENDALL)</span>
                <span className="text-cyber-cyan font-bold">{driftWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={driftWeight}
                onChange={(e) => setDriftWeight(Number(e.target.value))}
                className="w-full h-2 bg-space-950 rounded-lg appearance-none cursor-pointer accent-cyber-cyan"
              />
              <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                Weight for accelerating leakage current wear-out and thermal divergence.
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-slate-300">SEQUENCE AUTOENCODER</span>
                <span className="text-cyber-cyan font-bold">{sequenceWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={sequenceWeight}
                onChange={(e) => setSequenceWeight(Number(e.target.value))}
                className="w-full h-2 bg-space-950 rounded-lg appearance-none cursor-pointer accent-cyber-cyan"
              />
              <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                Weight for temporal sequence reconstruction error and micro-oscillations.
              </p>
            </div>
          </div>
        </div>

        {/* Environmental Setpoints & Nominal Ratings */}
        <div className="p-5 rounded-xl bg-space-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Thermometer className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-mono font-bold uppercase text-white">
              Nominal Chamber Baseline Ratings (MIL-STD-883K)
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1.5">NOMINAL VOLTAGE (V)</label>
              <input
                type="number"
                step="0.1"
                value={nominalVoltage}
                onChange={(e) => setNominalVoltage(Number(e.target.value))}
                className="w-full bg-space-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5">NOMINAL CURRENT (A)</label>
              <input
                type="number"
                step="0.01"
                value={nominalCurrent}
                onChange={(e) => setNominalCurrent(Number(e.target.value))}
                className="w-full bg-space-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5">LEAKAGE BASELINE (µA)</label>
              <input
                type="number"
                step="0.1"
                value={nominalLeakage}
                onChange={(e) => setNominalLeakage(Number(e.target.value))}
                className="w-full bg-space-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5">CHAMBER SETPOINT (°C)</label>
              <input
                type="number"
                step="1"
                value={chamberSetpoint}
                onChange={(e) => setChamberSetpoint(Number(e.target.value))}
                className="w-full bg-space-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-cyber-cyan text-space-950 font-bold text-xs shadow-cyan-glow hover:bg-cyan-300 transition-colors font-mono"
          >
            <Save className="w-4 h-4" />
            Save & Apply Settings
          </button>
        </div>
      </form>
    </div>
  );
};
