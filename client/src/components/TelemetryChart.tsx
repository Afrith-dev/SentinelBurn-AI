import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { TelemetrySample } from '../types';

interface TelemetryChartProps {
  samples: TelemetrySample[];
  cohortStats?: { leakageMean: number; leakageStd: number } | null;
  deviceName?: string;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  samples,
  cohortStats,
  deviceName = 'Selected Device'
}) => {
  const [activeChannel, setActiveChannel] = useState<'leakage' | 'voltage' | 'current' | 'temperature'>('leakage');

  // Format data for Recharts
  const chartData = samples.map((s, idx) => ({
    time: s.time ? new Date(s.time).toLocaleTimeString() : `T-${samples.length - idx}`,
    elapsed: s.elapsedHours ? `${s.elapsedHours.toFixed(1)}h` : `${idx * 5}s`,
    leakage_uA: s.readings ? +(s.readings.leakageCurrent * 1000).toFixed(3) : 2.5,
    voltage_V: s.readings ? +s.readings.voltage.toFixed(3) : 5.0,
    current_mA: s.readings ? +(s.readings.current * 1000).toFixed(2) : 180.0,
    temperature_C: s.readings ? +s.readings.temperature.toFixed(1) : 125.0,
    cohort_mean_uA: cohortStats ? +(cohortStats.leakageMean * 1000).toFixed(3) : 2.5,
    cohort_upper_2sigma_uA: cohortStats ? +((cohortStats.leakageMean + 2 * cohortStats.leakageStd) * 1000).toFixed(3) : 3.1,
  }));

  return (
    <div className="bg-space-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col">
      {/* Chart Header & Channel Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Parametric Telemetry Stream · {deviceName}
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Continuous sensor logging with cohort statistical baseline overlay
          </p>
        </div>

        {/* Channel Selector Buttons */}
        <div className="flex items-center gap-1.5 bg-space-850 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveChannel('leakage')}
            className={`px-3 py-1 rounded transition-all ${
              activeChannel === 'leakage'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Leakage I_R (µA)
          </button>
          <button
            onClick={() => setActiveChannel('voltage')}
            className={`px-3 py-1 rounded transition-all ${
              activeChannel === 'voltage'
                ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Voltage (V)
          </button>
          <button
            onClick={() => setActiveChannel('current')}
            className={`px-3 py-1 rounded transition-all ${
              activeChannel === 'current'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Current (mA)
          </button>
          <button
            onClick={() => setActiveChannel('temperature')}
            className={`px-3 py-1 rounded transition-all ${
              activeChannel === 'temperature'
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Chamber Temp (°C)
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
            Awaiting telemetry ticks for {deviceName}...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis 
                dataKey="elapsed" 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={11} 
                domain={['auto', 'auto']}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0b132b',
                  borderColor: '#1e293b',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }}
              />

              {activeChannel === 'leakage' && (
                <>
                  <ReferenceLine 
                    y={cohortStats ? +(cohortStats.leakageMean * 1000).toFixed(3) : 2.5} 
                    stroke="#38bdf8" 
                    strokeDasharray="4 4" 
                    label={{ value: 'Cohort Mean', fill: '#38bdf8', fontSize: 10 }} 
                  />
                  <ReferenceLine 
                    y={cohortStats ? +((cohortStats.leakageMean + 2 * cohortStats.leakageStd) * 1000).toFixed(3) : 3.1} 
                    stroke="#ef4444" 
                    strokeDasharray="3 3" 
                    label={{ value: '+2σ Limit', fill: '#ef4444', fontSize: 10 }} 
                  />
                  <Line
                    type="monotone"
                    dataKey="leakage_uA"
                    name="DUT Leakage (µA)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}

              {activeChannel === 'voltage' && (
                <>
                  <ReferenceLine y={5.0} stroke="#64748b" strokeDasharray="4 4" label="5.00V Nominal" />
                  <Line
                    type="monotone"
                    dataKey="voltage_V"
                    name="Voltage (V)"
                    stroke="#00f0ff"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}

              {activeChannel === 'current' && (
                <>
                  <ReferenceLine y={180.0} stroke="#64748b" strokeDasharray="4 4" label="180mA Nominal" />
                  <Line
                    type="monotone"
                    dataKey="current_mA"
                    name="Operating Current (mA)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}

              {activeChannel === 'temperature' && (
                <>
                  <ReferenceLine y={125.0} stroke="#f87171" strokeDasharray="4 4" label="125.0°C Setpoint" />
                  <Line
                    type="monotone"
                    dataKey="temperature_C"
                    name="DUT Temp (°C)"
                    stroke="#ff3366"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
