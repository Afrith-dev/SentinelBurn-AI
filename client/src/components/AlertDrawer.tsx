import React from 'react';
import { X, AlertTriangle, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRunStore } from '../store/runStore';

interface AlertDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlertDrawer: React.FC<AlertDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { alerts, activeRun, acknowledgeAlert } = useRunStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-space-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-space-900 border-l border-slate-800 shadow-2xl flex flex-col">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-space-850">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-alert-critical/20 text-alert-critical border border-alert-critical/30">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  AI Anomaly Alerts Feed
                </h2>
                <div className="text-[11px] font-mono text-slate-400">
                  {alerts.length} Total Events Detected
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Alerts List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-mono text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-60" />
                No active anomaly flags in current telemetry buffer.
              </div>
            ) : (
              alerts.map((alert) => {
                const isCritical = alert.severity === 'critical';
                const isWarning = alert.severity === 'warning';

                return (
                  <div 
                    key={alert.id} 
                    className={`p-3.5 rounded-lg border transition-all ${
                      isCritical
                        ? 'bg-alert-critical/10 border-alert-critical/40 hover:border-alert-critical/80'
                        : isWarning
                        ? 'bg-alert-warning/10 border-alert-warning/40 hover:border-alert-warning/80'
                        : 'bg-space-800 border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isCritical
                            ? 'bg-alert-critical text-white shadow-crimson-glow'
                            : isWarning
                            ? 'bg-alert-warning text-space-950 font-bold'
                            : 'bg-blue-600 text-white'
                        }`}>
                          {alert.severity} ({alert.score}%)
                        </span>
                        <span className="text-xs font-mono font-semibold text-slate-200">
                          {alert.deviceSerial || alert.deviceId}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(alert.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-2 font-sans leading-relaxed">
                      {alert.message}
                    </p>

                    {/* Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                      {!alert.acknowledgedAt ? (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="text-[11px] font-mono text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Acknowledge
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Acknowledged
                        </span>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          if (activeRun) {
                            navigate(`/runs/${activeRun.id}/devices/${alert.deviceId}`);
                          }
                        }}
                        className="text-[11px] font-mono font-medium text-cyber-cyan hover:underline flex items-center gap-1"
                      >
                        Deep Dive
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
