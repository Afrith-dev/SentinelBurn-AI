import { db } from '../database/store';
import { AuditService } from './audit.service';

export class ReportService {
  static generateLotReport(runId: string) {
    const run = db.runs.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const lot = run.lotId ? db.lots.get(run.lotId) : undefined;
    const deviceIds = db.runDevices.get(runId) || [];
    const devices = deviceIds.map(id => db.devices.get(`${runId}:${id}`)!).filter(Boolean);
    const runAlerts = Array.from(db.alerts.values()).filter(a => a.runId === runId);
    const auditChain = AuditService.verifyRunChain(runId);

    // Compute disposition metrics
    let accepted = 0;
    let rejected = 0;
    let holdFA = 0;
    let pending = 0;

    const deviceDispositions = devices.map(d => {
      const dispo = db.dispositions.get(d.id);
      if (dispo) {
        if (dispo.decision === 'accept') accepted++;
        else if (dispo.decision === 'reject') rejected++;
        else if (dispo.decision === 'hold_fa') holdFA++;
      } else {
        pending++;
      }

      return {
        deviceId: d.id,
        deviceSerial: d.deviceSerial,
        channelId: d.channelId,
        latestReadings: d.latestReadings,
        scores: d.latestScores,
        disposition: dispo
      };
    });

    const flaggedDevices = deviceDispositions.filter(d => (d.scores?.ensembleScore || 0) >= 35.0 || d.disposition);

    const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ISRO / SentinelBurn AI - Lot Disposition Report (${run.id})</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1a202c; background: #fff; }
    .header { border-bottom: 3px solid #00f0ff; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 24px; font-weight: bold; color: #0b192c; }
    .subtitle { color: #718096; font-size: 14px; margin-top: 5px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .badge-success { background: #c6f6d5; color: #22543d; }
    .badge-danger { background: #fed7d7; color: #742a2a; }
    .badge-warning { background: #feebc8; color: #7b341e; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0; }
    .card { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; }
    .card-label { font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 600; }
    .card-val { font-size: 20px; font-weight: bold; margin-top: 5px; color: #2d3748; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th { background: #edf2f7; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e0; }
    td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
    .audit-seal { background: #ebf8ff; border-left: 4px solid #3182ce; padding: 15px; border-radius: 4px; margin-top: 30px; }
    .hash { font-family: monospace; font-size: 11px; word-break: break-all; color: #2b6cb0; }
    .footer { margin-top: 40px; font-size: 11px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">🛰️ INDIAN SPACE RESEARCH ORGANISATION</div>
      <div class="subtitle">SentinelBurn AI · Space-Grade Component Screening & Burn-In Qualification Report</div>
    </div>
    <div style="text-align: right;">
      <span class="badge ${auditChain.isValid ? 'badge-success' : 'badge-danger'}">
        ${auditChain.isValid ? '✓ AUDIT HASH-CHAIN VERIFIED' : '⚠ AUDIT MISMATCH'}
      </span>
      <div class="subtitle">Generated: ${new Date().toUTCString()}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-label">Part Number / Spec</div>
      <div class="card-val" style="font-size: 15px;">${lot?.partNumber || 'HMC-9021'}<br><span style="font-size: 12px; font-weight: normal; color: #718096;">${lot?.specReference || 'MIL-STD-883K'}</span></div>
    </div>
    <div class="card">
      <div class="card-label">Total DUTs Monitored</div>
      <div class="card-val">${devices.length} DUTs</div>
    </div>
    <div class="card">
      <div class="card-label">Burn-In Duration</div>
      <div class="card-val">${run.elapsedHours.toFixed(1)} hrs</div>
    </div>
    <div class="card">
      <div class="card-label">Dispositions (Acc / Rej / Hold)</div>
      <div class="card-val" style="color: #2b6cb0;">${accepted} / ${rejected} / ${holdFA}</div>
    </div>
  </div>

  <h3>Flagged Components & Failure Analysis Review</h3>
  <table>
    <thead>
      <tr>
        <th>Device Serial</th>
        <th>Channel</th>
        <th>Leakage Current (I_R)</th>
        <th>Ensemble Score</th>
        <th>Detected Signature</th>
        <th>Engineer Disposition</th>
        <th>Engineer Notes</th>
      </tr>
    </thead>
    <tbody>
      ${flaggedDevices.map(d => `
        <tr>
          <td><strong>${d.deviceSerial}</strong></td>
          <td>Ch ${d.channelId}</td>
          <td>${d.latestReadings ? (d.latestReadings.leakageCurrent * 1000).toFixed(2) + ' µA' : 'N/A'}</td>
          <td>
            <span class="badge ${d.scores?.severity === 'critical' ? 'badge-danger' : d.scores?.severity === 'warning' ? 'badge-warning' : 'badge-success'}">
              ${d.scores?.ensembleScore || 0}%
            </span>
          </td>
          <td>${d.scores?.anomalyClassGuess || 'nominal'}</td>
          <td><strong>${d.disposition?.decision?.toUpperCase() || 'PENDING'}</strong></td>
          <td style="color: #4a5568;">${d.disposition?.comment || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="audit-seal">
    <strong>🔒 Tamper-Evident SHA-256 Audit Trail Certificate</strong>
    <p style="margin: 5px 0; font-size: 12px;">This lot disposition report has been cryptographically validated against the append-only aerospace audit ledger. Every state transition and engineer disposition is hash-chained.</p>
    <div style="margin-top: 8px;">
      <div><strong>Ledger Head Hash:</strong> <span class="hash">${auditChain.headHash || 'GENESIS'}</span></div>
      <div><strong>Total Audit Transactions:</strong> ${auditChain.totalRecords} events recorded</div>
      <div><strong>Chain Integrity Status:</strong> ${auditChain.isValid ? '100% Valid (Unbroken Cryptographic Chain)' : 'INTEGRITY VIOLATION'}</div>
    </div>
  </div>

  <div class="footer">
    <div>Classification: ISRO Restricted · Electronic Component Screening Centre</div>
    <div>System: SentinelBurn AI v1.2.0 · SIH26170</div>
  </div>
</body>
</html>
    `;

    return {
      runId,
      lot,
      run,
      metrics: {
        totalDevices: devices.length,
        accepted,
        rejected,
        holdFA,
        pending,
        flaggedCount: flaggedDevices.length,
        elapsedHours: run.elapsedHours
      },
      flaggedDevices,
      auditChain,
      htmlReport
    };
  }
}
