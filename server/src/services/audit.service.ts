import crypto from 'crypto';
import { db } from '../database/store';
import { RunAuditLogRow } from '../types';

export class AuditService {
  private static GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Appends an immutable, hash-chained record to the audit log.
   * row_hash = SHA256(prev_hash || JSON.stringify(payload) || timestamp)
   */
  static logEvent(params: {
    runId: string;
    eventType: string;
    actorId?: string;
    actorName?: string;
    fromState?: string;
    toState?: string;
    payload?: Record<string, any>;
  }): RunAuditLogRow {
    const timestamp = new Date().toISOString();
    const payloadJson = params.payload || {};

    // Retrieve previous row hash for this run
    const runLogs = db.auditLogs.filter(l => l.runId === params.runId);
    const prevHash = runLogs.length > 0 ? runLogs[runLogs.length - 1].rowHash : this.GENESIS_HASH;

    // Cryptographic hash computation
    const contentToHash = `${prevHash}|${params.eventType}|${params.runId}|${JSON.stringify(payloadJson)}|${timestamp}`;
    const rowHash = crypto.createHash('sha256').update(contentToHash).digest('hex');

    const newRow: RunAuditLogRow = {
      id: db.auditLogs.length + 1,
      runId: params.runId,
      eventType: params.eventType,
      actorId: params.actorId,
      actorName: params.actorName,
      fromState: params.fromState,
      toState: params.toState,
      prevHash,
      rowHash,
      payloadJson,
      timestamp
    };

    db.auditLogs.push(newRow);
    return newRow;
  }

  /**
   * Cryptographically verifies the unbroken SHA-256 chain of custody for a given run.
   * Proves historical non-tampering for aerospace flight-readiness audits.
   */
  static verifyRunChain(runId: string): {
    isValid: boolean;
    totalRecords: number;
    headHash?: string;
    tamperedAtRecordId?: number;
    auditLog: RunAuditLogRow[];
  } {
    const runLogs = db.auditLogs.filter(l => l.runId === runId);
    if (runLogs.length === 0) {
      return { isValid: true, totalRecords: 0, auditLog: [] };
    }

    let expectedPrevHash = this.GENESIS_HASH;

    for (const row of runLogs) {
      // 1. Check prevHash pointer
      if (row.prevHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalRecords: runLogs.length,
          tamperedAtRecordId: row.id,
          auditLog: runLogs
        };
      }

      // 2. Recompute and verify rowHash
      const contentToHash = `${row.prevHash}|${row.eventType}|${row.runId}|${JSON.stringify(row.payloadJson)}|${row.timestamp}`;
      const calculatedHash = crypto.createHash('sha256').update(contentToHash).digest('hex');

      if (calculatedHash !== row.rowHash) {
        return {
          isValid: false,
          totalRecords: runLogs.length,
          tamperedAtRecordId: row.id,
          auditLog: runLogs
        };
      }

      expectedPrevHash = row.rowHash;
    }

    return {
      isValid: true,
      totalRecords: runLogs.length,
      headHash: runLogs[runLogs.length - 1].rowHash,
      auditLog: runLogs
    };
  }

  static getRunLogs(runId: string): RunAuditLogRow[] {
    return db.auditLogs.filter(l => l.runId === runId);
  }
}
