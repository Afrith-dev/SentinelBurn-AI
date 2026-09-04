import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Radio, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  ArrowRight, 
  Layers, 
  BrainCircuit, 
  Zap, 
  FileCheck2, 
  Lock 
} from 'lucide-react';

export const Landing: React.FC = () => {
  return (
    <div className="space-y-16 py-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-space-900 via-space-900/90 to-space-950 border border-slate-800/80 p-8 lg:p-14 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyber-cyan/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-space-850 border border-cyber-cyan/30 text-xs font-mono text-cyber-cyan shadow-cyan-glow">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            ISRO PROBLEM STATEMENT SIH26170 · SMART AUTOMATION
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            AI-Driven Anomaly Detection for Space-Grade Component{' '}
            <span className="bg-gradient-to-r from-cyber-cyan via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Burn-In & Screening
            </span>
          </h1>

          <p className="text-base text-slate-300 leading-relaxed font-sans">
            Moving beyond static pass/fail thresholds. SentinelBurn AI continuously monitors hundreds of Devices Under Test (DUTs) inside thermal chambers, capturing subtle drift, micro-oscillations, and cohort outliers years before an infant mortality failure would jeopardize a satellite mission in orbit.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyber-cyan to-blue-600 text-space-950 font-bold text-sm shadow-cyan-glow hover:opacity-95 transition-opacity"
            >
              <Activity className="w-4 h-4" />
              Launch Mission Console
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/models"
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-space-850 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm transition-colors"
            >
              <BrainCircuit className="w-4 h-4 text-cyber-cyan" />
              Inspect AI Ensemble (F1: 93.3%)
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-10 border-t border-slate-800/80">
          <div>
            <div className="text-2xl font-mono font-bold text-cyber-cyan">200 DUTs</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">Real-Time Channel Matrix</div>
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-emerald-400">3-Model</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">Ensemble Fusion Core</div>
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-amber-400">SHAP</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">Feature Attribution XAI</div>
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-blue-400">SHA-256</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">Tamper-Evident Hash Chain</div>
          </div>
        </div>
      </section>

      {/* The Anomaly Detection Gap Section */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl font-extrabold uppercase tracking-wide text-white">
            Why Static Thresholds Fail Space Electronics
          </h2>
          <p className="text-xs font-mono text-slate-400">
            Comparing conventional screening against SentinelBurn AI's multi-paradigm pipeline
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-space-900 border border-red-900/30 space-y-4">
            <div className="flex items-center gap-2 text-alert-critical font-bold text-sm">
              Conventional Manual / Static Screening
            </div>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-alert-critical font-bold mt-0.5">✕</span>
                <span><strong>Misses Slow Drift:</strong> Components drifting 50% above baseline never trigger alerts if they stay beneath hard limits.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-alert-critical font-bold mt-0.5">✕</span>
                <span><strong>Ignores Cohort Statistics:</strong> A device behaving 3σ away from its lot is ignored if the lot is nominally tight.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-alert-critical font-bold mt-0.5">✕</span>
                <span><strong>Late Detection:</strong> Failures only identified after 168 hours have elapsed, wasting chamber electricity and time.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-alert-critical font-bold mt-0.5">✕</span>
                <span><strong>No Explainability:</strong> Engineers spend weeks in Failure Analysis (FA) guessing why the part degraded.</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-xl bg-space-900 border border-cyber-cyan/30 space-y-4 shadow-cyan-glow">
            <div className="flex items-center gap-2 text-cyber-cyan font-bold text-sm">
              SentinelBurn AI Space Qualification
            </div>
            <ul className="space-y-3 text-xs text-slate-200">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                <span><strong>Multi-Model Ensemble:</strong> Point (Isolation Forest), Drift (STL + Mann-Kendall), and Sequence (Autoencoder) detectors combine for complete coverage.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                <span><strong>Live Cohort Baselining:</strong> Real-time z-score envelopes flag statistically deviant DUTs even within datasheet spec limits.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                <span><strong>Sub-Second Early Warning:</strong> Alerts fire in &lt;1 second when non-linear divergence manifests during the run.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                <span><strong>Instant SHAP Root-Cause:</strong> Clear mathematical feature attributions and natural-language failure narratives.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* End-to-End Pipeline Interactive Card */}
      <section className="bg-space-900 border border-slate-800 rounded-xl p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">
              End-to-End Autonomous Screening Pipeline
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              From chamber telemetry to cryptographic flight qualification seal
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-space-850 text-cyber-cyan text-xs font-mono border border-cyber-cyan/30">
            AUDIT-GRADE TRACEABILITY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs font-mono">
          <div className="p-4 rounded-lg bg-space-850 border border-slate-800 space-y-2">
            <div className="text-cyber-cyan font-bold">1. TELEMETRY</div>
            <p className="text-slate-300 font-sans">200 DUTs streamed via MQTT / WebSocket bus every 5 sec.</p>
          </div>
          <div className="p-4 rounded-lg bg-space-850 border border-slate-800 space-y-2">
            <div className="text-blue-400 font-bold">2. ENSEMBLE AI</div>
            <p className="text-slate-300 font-sans">Isolation Forest + STL Drift + Sequence Autoencoder.</p>
          </div>
          <div className="p-4 rounded-lg bg-space-850 border border-slate-800 space-y-2">
            <div className="text-amber-400 font-bold">3. SHAP XAI</div>
            <p className="text-slate-300 font-sans">Feature attribution decomposing the exact anomaly signature.</p>
          </div>
          <div className="p-4 rounded-lg bg-space-850 border border-slate-800 space-y-2">
            <div className="text-emerald-400 font-bold">4. DISPOSITION</div>
            <p className="text-slate-300 font-sans">Engineer Accept / Reject / Hold FA decisions recorded.</p>
          </div>
          <div className="p-4 rounded-lg bg-space-850 border border-slate-800 space-y-2">
            <div className="text-purple-400 font-bold">5. HASH CHAIN</div>
            <p className="text-slate-300 font-sans">SHA-256 chained audit trail and PDF Lot Disposition Report.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
