import { Server, Socket } from 'socket.io';
import { GeminiLiveService } from '../services/gemini-live.service';
import { AnalysisService } from '../services/analysis.service';

export class SocketHandler {
  private static io: Server | null = null;
  private static liveSessions = new Map<string, { session: any; lifecycle: { intentionalClose: boolean } }>();
  private static monitors = new Map<string, { runId: string; timer: NodeJS.Timeout; signature: string }>();

  static initialize(io: Server) {
    this.io = io;

    io.on('connection', (socket: Socket) => {
      socket.on('join_run', (runId: string) => {
        socket.join(`run:${runId}`);
      });

      socket.on('leave_run', (runId: string) => {
        socket.leave(`run:${runId}`);
      });

      socket.on('voice:connect', async () => {
        const previous = this.liveSessions.get(socket.id);
        if (previous) {
          previous.lifecycle.intentionalClose = true;
          try {
            previous.session.close();
          } catch (_) {}
          this.liveSessions.delete(socket.id);
        }

        const lifecycle = { intentionalClose: false };
        const result = await GeminiLiveService.createLiveSession(socket, lifecycle);
        if (!result.connected || !result.session) {
          socket.emit('voice:error', { message: result.error || 'Unable to connect to Gemini Live.' });
          socket.emit('voice:state', 'ERROR');
          return;
        }

        this.liveSessions.set(socket.id, { session: result.session, lifecycle });
        socket.data.liveSession = result.session;
        socket.data.liveSessionLifecycle = lifecycle;
        socket.emit('voice:connected', { model: result.model });
        socket.emit('voice:state', 'LISTENING');
      });

      socket.on('voice:monitor-start', async (runId?: string) => {
        const selectedRun = AnalysisService.getCurrentRun(runId);
        if (!selectedRun) {
          socket.emit('voice:monitor-error', { message: 'No SentinelBurn run is available to monitor.' });
          return;
        }
        const existing = this.monitors.get(socket.id);
        if (existing) clearInterval(existing.timer);
        const monitorRunId = selectedRun.id;
        const poll = async () => {
          const analysis = await AnalysisService.analyzeRun(monitorRunId);
          const highest = analysis.criticalDevices[0] || analysis.anomalies[0];
          const signature = JSON.stringify({
            reporting: analysis.run.reportingDevices,
            highest: highest ? [highest.deviceId, highest.score, highest.severity] : null,
            critical: analysis.criticalDevices.length
          });
          const monitor = this.monitors.get(socket.id);
          if (!monitor || monitor.signature === signature) return;
          monitor.signature = signature;
          socket.emit('voice:monitor-update', {
            runId: monitorRunId,
            severity: analysis.criticalDevices.length ? 'critical' : analysis.anomalies.length ? 'warning' : 'nominal',
            message: highest ? `Monitoring update: ${highest.deviceId} is currently ${highest.severity} at score ${highest.score}.` : 'Monitoring update: no elevated anomaly scores are currently available.',
            analysis
          });
        };
        const timer = setInterval(() => { void poll(); }, 5000);
        this.monitors.set(socket.id, { runId: monitorRunId, timer, signature: '' });
        await poll();
        socket.emit('voice:monitoring', { runId: monitorRunId, active: true });
      });

      socket.on('voice:monitor-stop', () => {
        const monitor = this.monitors.get(socket.id);
        if (monitor) clearInterval(monitor.timer);
        this.monitors.delete(socket.id);
        socket.emit('voice:monitoring', { active: false });
      });

      socket.on('voice:audio', (payload: number[] | Uint8Array | ArrayBuffer) => {
        const session = this.liveSessions.get(socket.id)?.session || socket.data.liveSession;
        if (!session) return;

        let buffer: Uint8Array;
        if (payload instanceof ArrayBuffer) {
          buffer = new Uint8Array(payload);
        } else if (payload instanceof Uint8Array) {
          buffer = payload;
        } else if (Array.isArray(payload)) {
          buffer = Uint8Array.from(payload);
        } else if (typeof payload === 'object' && payload && 'data' in payload) {
          buffer = new Uint8Array((payload as any).data);
        } else {
          return;
        }

        if (buffer.length > 0) {
          try {
            const audioData = Buffer.from(buffer).toString('base64');
            session.sendRealtimeInput({
              audio: {
                data: audioData,
                mimeType: 'audio/pcm;rate=16000'
              }
            });
          } catch (error: any) {
            console.error('Gemini Live audio forwarding failed:', error?.message || error);
            socket.emit('voice:error', { message: 'Microphone audio could not be sent to Gemini Live.' });
          }
        }
      });

      socket.on('voice:audio-end', () => {
        const session = this.liveSessions.get(socket.id)?.session || socket.data.liveSession;
        if (!session) return;
        session.sendRealtimeInput({ audioStreamEnd: true });
      });

      socket.on('voice:text', (text: string) => {
        const session = this.liveSessions.get(socket.id)?.session || socket.data.liveSession;
        if (!session || !text?.trim()) return;
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true
        });
      });

      socket.on('voice:disconnect-session', () => {
        const entry = this.liveSessions.get(socket.id);
        const session = entry?.session || socket.data.liveSession;
        if (entry) {
          entry.lifecycle.intentionalClose = true;
        } else if (socket.data.liveSessionLifecycle) {
          socket.data.liveSessionLifecycle.intentionalClose = true;
        }
        if (session) {
          try {
            session.close();
          } catch (_) {}
        }
        this.liveSessions.delete(socket.id);
        socket.data.liveSession = null;
        socket.data.liveSessionLifecycle = null;
        socket.emit('voice:state', 'IDLE');
      });

      socket.on('disconnect', () => {
        const monitor = this.monitors.get(socket.id);
        if (monitor) clearInterval(monitor.timer);
        this.monitors.delete(socket.id);
        const entry = this.liveSessions.get(socket.id);
        const session = entry?.session || socket.data.liveSession;
        if (entry) {
          entry.lifecycle.intentionalClose = true;
        } else if (socket.data.liveSessionLifecycle) {
          socket.data.liveSessionLifecycle.intentionalClose = true;
        }
        if (session) {
          try {
            session.close();
          } catch (_) {}
        }
        this.liveSessions.delete(socket.id);
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
