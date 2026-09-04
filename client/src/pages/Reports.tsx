import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  Lock,
  Hash
} from 'lucide-react';
import { runsApi, reportsApi } from '../services/api';
import { Run } from '../types';

export const Reports: React.FC = () => {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('run-isro-live-001');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const data = await runsApi.getRuns();
        setRuns(data);
        if (data.length > 0) {
          setSelectedRunId(data[0].id);
        }
      } catch (e) {
        console.error('Error fetching runs:', e);
      }
    };
    fetchRuns();
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;

    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await reportsApi.getReport(selectedRunId);
        setReportData(data);
      } catch (e) {
        console.error('Error fetching report:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedRunId]);

  const auditChain = reportData?.auditChain;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyber-cyan" />
            <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-wider text-white">
              Official Lot Disposition & Qualification Reports
            </h1>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Flight-readiness certificates with cryptographic SHA-256 audit chain verification
          </p>
        </div>

        {/* Export / Print Actions */}
        <div className="flex items-center gap-2">
          <a
            href={`http://localhost:4000/api/runs/${selectedRunId}/report/html`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-cyan text-space-950 font-bold text-xs shadow-cyan-glow hover:bg-cyan-300 transition-colors font-mono"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Export Official PDF
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Run Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRunId(r.id)}
            className={`px-4 py-2 rounded-lg border transition-all shrink-0 ${
              selectedRunId === r.id
                ? 'bg-space-850 text-cyber-cyan border-cyber-cyan/50 shadow-cyan-glow font-bold'
                : 'bg-space-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {r.id} ({r.lot?.partNumber || 'HMC-9021'})
          </button>
        ))}
      </div>

      {/* Cryptographic SHA-256 Audit Seal Card */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-space-900 via-space-850 to-space-900 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                Tamper-Evident SHA-256 Audit Trail Seal
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                  auditChain?.isValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400'
                }`}>
                  {auditChain?.isValid ? '✓ 100% UNBROKEN INTEGRITY' : '⚠ CHAIN MISMATCH'}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400">
                Guarantees immutable historical lineage for ISRO flight documentation compliance
              </p>
            </div>
          </div>

          <div className="text-right text-xs font-mono text-slate-400">
            Total Audit Records: <strong className="text-white">{auditChain?.totalRecords || 0}</strong>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-space-950/80 border border-slate-800/80 font-mono text-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-400">
            <Hash className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>LEDGER HEAD HASH:</span>
          </div>
          <div className="text-[11px] text-cyber-cyan break-all bg-space-900 p-2 rounded border border-slate-800">
            {auditChain?.headHash || '0000000000000000000000000000000000000000000000000000000000000000'}
          </div>
        </div>
      </div>

      {/* Lot Disposition Summary Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-space-900 border border-slate-800">
          <span className="text-xs font-mono text-slate-400 block">TOTAL DUTS TESTED</span>
          <span className="text-2xl font-mono font-bold text-white mt-1 block">
            {reportData?.metrics?.totalDevices || 200}
          </span>
          <span className="text-[10px] font-mono text-slate-400">100% Screened</span>
        </div>

        <div className="p-4 rounded-xl bg-space-900 border border-slate-800">
          <span className="text-xs font-mono text-slate-400 block">ACCEPTED (QUALIFIED)</span>
          <span className="text-2xl font-mono font-bold text-emerald-400 mt-1 block">
            {reportData?.metrics?.accepted || 0}
          </span>
          <span className="text-[10px] font-mono text-emerald-400">Flight Hardware Grade</span>
        </div>

        <div className="p-4 rounded-xl bg-space-900 border border-slate-800">
          <span className="text-xs font-mono text-slate-400 block">REJECTED (DEFECTIVE)</span>
          <span className="text-2xl font-mono font-bold text-alert-critical mt-1 block">
            {reportData?.metrics?.rejected || 0}
          </span>
          <span className="text-[10px] font-mono text-alert-critical">Latent Defect Screened</span>
        </div>

        <div className="p-4 rounded-xl bg-space-900 border border-slate-800">
          <span className="text-xs font-mono text-slate-400 block">HOLD FOR FA</span>
          <span className="text-2xl font-mono font-bold text-alert-warning mt-1 block">
            {reportData?.metrics?.holdFA || 0}
          </span>
          <span className="text-[10px] font-mono text-alert-warning">Under Investigation</span>
        </div>
      </div>

      {/* Table of Flagged / Disposed Devices */}
      <div className="bg-space-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Flagged Components & Anomaly Audit Records
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {reportData?.flaggedDevices?.length || 0} UNITS RECORDED
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">DEVICE SERIAL</th>
                <th className="pb-3 font-semibold">CHANNEL</th>
                <th className="pb-3 font-semibold">LEAKAGE I_R</th>
                <th className="pb-3 font-semibold">ENSEMBLE SCORE</th>
                <th className="pb-3 font-semibold">DETECTED SIGNATURE</th>
                <th className="pb-3 font-semibold">DISPOSITION</th>
                <th className="pb-3 font-semibold">ENGINEER NOTES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {reportData?.flaggedDevices?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No flagged devices recorded yet for this run.
                  </td>
                </tr>
              ) : (
                reportData?.flaggedDevices?.map((d: any) => (
                  <tr key={d.deviceId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-bold text-slate-200">{d.deviceSerial}</td>
                    <td className="py-3 text-slate-300">CH {d.channelId}</td>
                    <td className="py-3 text-amber-400">
                      {d.latestReadings ? (d.latestReadings.leakageCurrent * 1000).toFixed(2) + ' µA' : 'N/A'}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.scores?.severity === 'critical' ? 'bg-alert-critical text-white' : 'bg-alert-warning text-space-950'
                      }`}>
                        {d.scores?.ensembleScore || 0}%
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">{d.scores?.anomalyClassGuess || 'nominal'}</td>
                    <td className="py-3 font-bold uppercase">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        d.disposition?.decision === 'reject' ? 'bg-red-950 text-red-400 border border-red-800' :
                        d.disposition?.decision === 'accept' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {d.disposition?.decision || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 max-w-xs truncate">{d.disposition?.comment || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
