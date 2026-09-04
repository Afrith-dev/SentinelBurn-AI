"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const store_1 = require("../database/store");
class AuditService {
    static GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
    /**
     * Appends an immutable, hash-chained record to the audit log.
     * row_hash = SHA256(prev_hash || JSON.stringify(payload) || timestamp)
     */
    static logEvent(params) {
        const timestamp = new Date().toISOString();
        const payloadJson = params.payload || {};
        // Retrieve previous row hash for this run
        const runLogs = store_1.db.auditLogs.filter(l => l.runId === params.runId);
        const prevHash = runLogs.length > 0 ? runLogs[runLogs.length - 1].rowHash : this.GENESIS_HASH;
        // Cryptographic hash computation
        const contentToHash = `${prevHash}|${params.eventType}|${params.runId}|${JSON.stringify(payloadJson)}|${timestamp}`;
        const rowHash = crypto_1.default.createHash('sha256').update(contentToHash).digest('hex');
        const newRow = {
            id: store_1.db.auditLogs.length + 1,
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
        store_1.db.auditLogs.push(newRow);
        return newRow;
    }
    /**
     * Cryptographically verifies the unbroken SHA-256 chain of custody for a given run.
     * Proves historical non-tampering for aerospace flight-readiness audits.
     */
    static verifyRunChain(runId) {
        const runLogs = store_1.db.auditLogs.filter(l => l.runId === runId);
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
            const calculatedHash = crypto_1.default.createHash('sha256').update(contentToHash).digest('hex');
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
    static getRunLogs(runId) {
        return store_1.db.auditLogs.filter(l => l.runId === runId);
    }
}
exports.AuditService = AuditService;
