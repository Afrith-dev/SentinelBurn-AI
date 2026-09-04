import React from 'react';
import { ShapExplanation } from '../types';
import { HelpCircle, BrainCircuit, Activity } from 'lucide-react';

interface ShapWaterfallProps {
  explanation?: ShapExplanation | null;
  anomalyClass?: string;
  score?: number;
}

export const ShapWaterfall: React.FC<ShapWaterfallProps> = ({
  explanation,
  anomalyClass = 'gradual_drift',
  score = 75.0
}) => {
  if (!explanation) {
    return (
      <div className="bg-space-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
          <BrainCircuit className="w-4 h-4 animate-spin text-cyber-cyan" />
          Computing Shapley feature attribution decomposition...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-space-900 border border-slate-800 rounded-xl p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              SHAP Explainability & Root-Cause Attribution
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Additive game-theoretic feature importance per MIL-STD qualification standards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Diagnosis:</span>
          <span className="px-2 py-0.5 rounded bg-space-850 text-amber-400 border border-amber-400/30 uppercase font-bold text-[11px]">
            {anomalyClass.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Human-Readable Narrative Box */}
      <div className="p-3.5 rounded-lg bg-space-850 border border-slate-800/90 mb-5">
        <div className="flex items-start gap-2.5">
          <Activity className="w-4 h-4 text-cyber-cyan mt-0.5 shrink-0" />
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              Automated Flight Reliability Diagnosis
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {explanation.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Waterfall / Feature Attribution Bars */}
      <div className="space-y-3">
        <div className="text-xs font-mono text-slate-400 flex justify-between px-1">
          <span>PARAMETRIC FEATURE ATTRIBUTION</span>
          <span>SHAP IMPACT WEIGHT (%)</span>
        </div>

        {explanation.topContributingFeatures.map((feat, idx) => {
          const pct = feat.percentage || Math.round(feat.shapValue * 100);
          const isHigh = pct >= 30;

          return (
            <div key={idx} className="p-2.5 rounded-lg bg-space-950/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="font-semibold text-slate-200">{feat.displayName}</span>
                <span className={`font-bold ${isHigh ? 'text-cyber-cyan' : 'text-slate-400'}`}>
                  +{feat.shapValue.toFixed(3)} ({pct}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-space-850 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    idx === 0
                      ? 'bg-gradient-to-r from-cyber-cyan to-blue-500'
                      : 'bg-slate-600'
                  }`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>

              {/* Metrics metadata */}
              {feat.observedValue !== undefined && feat.cohortBaseline !== undefined && (
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Observed: <strong className="text-slate-200">{feat.observedValue} {feat.unit}</strong></span>
                  <span>Cohort Mean: <strong className="text-slate-300">{feat.cohortBaseline} {feat.unit}</strong></span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
