import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Device } from '../types';
import { AlertTriangle, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';

interface DeviceHeatmapProps {
  runId: string;
  devices: Device[];
  onSelectDevice?: (deviceId: string) => void;
}

export const DeviceHeatmap: React.FC<DeviceHeatmapProps> = ({ runId, devices, onSelectDevice }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'nominal' | 'disposed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredDev, setHoveredDev] = useState<Device | null>(null);

  const getScoreColor = (score?: number) => {
    if (score === undefined || score === null) return 'bg-slate-800 border-slate-700 text-slate-400';
    if (score >= 65.0) return 'bg-alert-critical text-white border-red-400 shadow-crimson-glow animate-pulse-fast';
    if (score >= 40.0) return 'bg-alert-warning text-space-950 border-amber-300 font-bold';
    if (score >= 25.0) return 'bg-blue-600/80 text-white border-blue-400';
    return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:border-emerald-400';
  };

  const filteredDevices = devices.filter((d) => {
    const score = d.latestScores?.ensembleScore || 0;
    const matchesSearch = d.deviceSerial.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(d.channelId).includes(searchTerm);

    if (!matchesSearch) return false;

    if (filter === 'critical') return score >= 65.0;
    if (filter === 'warning') return score >= 40.0 && score < 65.0;
    if (filter === 'nominal') return score < 40.0;
    if (filter === 'disposed') return !!d.disposition;
    return true;
  });

  const counts = {
    all: devices.length,
    critical: devices.filter(d => (d.latestScores?.ensembleScore || 0) >= 65.0).length,
    warning: devices.filter(d => {
      const s = d.latestScores?.ensembleScore || 0;
      return s >= 40.0 && s < 65.0;
    }).length,
    nominal: devices.filter(d => (d.latestScores?.ensembleScore || 0) < 40.0).length,
    disposed: devices.filter(d => !!d.disposition).length,
  };

  const handleDeviceClick = (deviceId: string) => {
    if (onSelectDevice) {
      onSelectDevice(deviceId);
    } else {
      navigate(`/runs/${runId}/devices/${deviceId}`);
    }
  };

  return (
    <div className="bg-space-900 border border-slate-800/90 rounded-xl p-5 shadow-xl">
      {/* Matrix Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyber-cyan" />
              200-DUT Qualification Matrix Grid
            </h3>
            <span className="text-xs font-mono text-slate-400">
              ({filteredDevices.length} Shown)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time heat signature of all channel devices. Color indicates Anomaly Confidence Score (0–100).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search serial / ch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-space-850 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyber-cyan"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-space-850 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filter === 'all' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                filter === 'critical' ? 'bg-alert-critical text-white font-bold shadow-crimson-glow' : 'text-alert-critical hover:bg-alert-critical/10'
              }`}
            >
              Critical ({counts.critical})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filter === 'warning' ? 'bg-alert-warning text-space-950 font-bold' : 'text-alert-warning hover:bg-alert-warning/10'
              }`}
            >
              Warning ({counts.warning})
            </button>
            <button
              onClick={() => setFilter('nominal')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filter === 'nominal' ? 'bg-emerald-800 text-white' : 'text-emerald-400 hover:bg-emerald-950/40'
              }`}
            >
              Nominal ({counts.nominal})
            </button>
            <button
              onClick={() => setFilter('disposed')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filter === 'disposed' ? 'bg-blue-600 text-white' : 'text-blue-400 hover:bg-blue-950/40'
              }`}
            >
              Disposed ({counts.disposed})
            </button>
          </div>
        </div>
      </div>

      {/* 200-Device Matrix Grid (20 columns x 10 rows on lg screens) */}
      <div className="relative">
        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-20 gap-1.5 p-3 bg-space-950/80 rounded-lg border border-slate-800/80 min-h-[220px]">
          {filteredDevices.map((dev) => {
            const score = dev.latestScores?.ensembleScore;
            const hasDispo = !!dev.disposition;
            const dispoDecision = dev.disposition?.decision;

            return (
              <button
                key={dev.id}
                onClick={() => handleDeviceClick(dev.id)}
                onMouseEnter={() => setHoveredDev(dev)}
                onMouseLeave={() => setHoveredDev(null)}
                className={`relative group aspect-square rounded flex flex-col items-center justify-center p-1 border transition-all duration-150 transform hover:scale-110 hover:z-20 ${getScoreColor(
                  score
                )}`}
                title={`Device ${dev.deviceSerial} (Channel ${dev.channelId})`}
              >
                {/* Channel number */}
                <span className="text-[10px] font-mono font-bold leading-none">
                  {dev.channelId}
                </span>

                {/* Micro anomaly score badge */}
                {score !== undefined && (
                  <span className="text-[8px] font-mono leading-none mt-0.5 opacity-90">
                    {Math.round(score)}%
                  </span>
                )}

                {/* Disposition indicator badge */}
                {hasDispo && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-[8px] bg-slate-900 border border-white">
                    {dispoDecision === 'accept' && <span className="text-emerald-400 font-bold">✓</span>}
                    {dispoDecision === 'reject' && <span className="text-red-400 font-bold">✕</span>}
                    {dispoDecision === 'hold_fa' && <span className="text-amber-400 font-bold">!</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Live Hover Telemetry Inspection Card */}
        {hoveredDev && (
          <div className="absolute top-2 right-2 bg-space-900/95 backdrop-blur-md border border-cyber-cyan/50 rounded-lg p-3 shadow-cyan-glow text-xs z-30 pointer-events-none w-64">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="font-mono font-bold text-slate-100">{hoveredDev.deviceSerial}</span>
              <span className="font-mono text-cyber-cyan">CH {hoveredDev.channelId}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block">Voltage:</span>
                <span className="text-slate-200 font-semibold">{hoveredDev.latestReadings?.voltage?.toFixed(3) || '5.000'} V</span>
              </div>
              <div>
                <span className="text-slate-400 block">Current:</span>
                <span className="text-slate-200 font-semibold">{hoveredDev.latestReadings?.current?.toFixed(3) || '0.180'} A</span>
              </div>
              <div>
                <span className="text-slate-400 block">Leakage (I_R):</span>
                <span className="text-amber-400 font-bold">
                  {hoveredDev.latestReadings ? (hoveredDev.latestReadings.leakageCurrent * 1000).toFixed(2) + ' µA' : '2.50 µA'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Temp:</span>
                <span className="text-slate-200 font-semibold">{hoveredDev.latestReadings?.temperature?.toFixed(1) || '125.0'} °C</span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between font-mono">
              <span className="text-slate-400">Ensemble Score:</span>
              <span className={`font-bold ${
                (hoveredDev.latestScores?.ensembleScore || 0) >= 65 ? 'text-alert-critical' :
                (hoveredDev.latestScores?.ensembleScore || 0) >= 40 ? 'text-alert-warning' : 'text-emerald-400'
              }`}>
                {hoveredDev.latestScores?.ensembleScore || 0}% ({hoveredDev.latestScores?.severity || 'nominal'})
              </span>
            </div>
            {hoveredDev.disposition && (
              <div className="mt-1 text-[10px] font-mono text-blue-400 uppercase">
                Disposition: {hoveredDev.disposition.decision}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-950/80 border border-emerald-800" />
            <span>Nominal (0-25%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-600 border border-blue-400" />
            <span>Info / Normal Drift (25-40%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-alert-warning border border-amber-300" />
            <span>Warning (40-65%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-alert-critical border border-red-400 animate-pulse" />
            <span>Critical Anomaly (&gt;65%)</span>
          </div>
        </div>
        <div>
          <span>Click any DUT for single-device deep dive</span>
        </div>
      </div>
    </div>
  );
};
