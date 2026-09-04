"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketHandler = void 0;
class SocketHandler {
    static io = null;
    static initialize(io) {
        this.io = io;
        io.on('connection', (socket) => {
            // Room subscription for scoped telemetry
            socket.on('join_run', (runId) => {
                socket.join(`run:${runId}`);
            });
            socket.on('leave_run', (runId) => {
                socket.leave(`run:${runId}`);
            });
            socket.on('disconnect', () => {
                // cleanup if needed
            });
        });
    }
    static broadcastTelemetryTick(runId, data) {
        if (!this.io)
            return;
        this.io.to(`run:${runId}`).emit('telemetry:tick', data);
    }
    static broadcastAnomalyFlagged(runId, alertPayload) {
        if (!this.io)
            return;
        this.io.to(`run:${runId}`).emit('anomaly:flagged', alertPayload);
    }
    static broadcastRunStatusChanged(runId, data) {
        if (!this.io)
            return;
        this.io.to(`run:${runId}`).emit('run:status_changed', data);
        this.io.emit('runs:updated', data);
    }
    static broadcastDispositionCreated(runId, disposition) {
        if (!this.io)
            return;
        this.io.to(`run:${runId}`).emit('disposition:created', disposition);
    }
}
exports.SocketHandler = SocketHandler;
