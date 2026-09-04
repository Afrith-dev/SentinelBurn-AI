import { Server, Socket } from 'socket.io';

export class SocketHandler {
  private static io: Server | null = null;

  static initialize(io: Server) {
    this.io = io;

    io.on('connection', (socket: Socket) => {
      // Room subscription for scoped telemetry
      socket.on('join_run', (runId: string) => {
        socket.join(`run:${runId}`);
      });

      socket.on('leave_run', (runId: string) => {
        socket.leave(`run:${runId}`);
      });

      socket.on('disconnect', () => {
        // cleanup if needed
      });
    });
  }

  static broadcastTelemetryTick(runId: string, data: any) {
    if (!this.io) return;
    this.io.to(`run:${runId}`).emit('telemetry:tick', data);
  }

  static broadcastAnomalyFlagged(runId: string, alertPayload: any) {
    if (!this.io) return;
    this.io.to(`run:${runId}`).emit('anomaly:flagged', alertPayload);
  }

  static broadcastRunStatusChanged(runId: string, data: any) {
    if (!this.io) return;
    this.io.to(`run:${runId}`).emit('run:status_changed', data);
    this.io.emit('runs:updated', data);
  }

  static broadcastDispositionCreated(runId: string, disposition: any) {
    if (!this.io) return;
    this.io.to(`run:${runId}`).emit('disposition:created', disposition);
  }
}
