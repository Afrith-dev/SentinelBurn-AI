import { GoogleGenAI, Modality } from '@google/genai';
import { db } from '../database/store';
import { ActionService } from './action.service';
import { AnalysisService } from './analysis.service';

export interface GeminiLiveStatus {
  configured: boolean;
  mode: 'gemini-live' | 'fallback';
  model: string;
  liveModel: string;
  voiceName: string;
  message: string;
}

export interface GeminiTextResult {
  mode: 'live' | 'fallback';
  text: string;
  model?: string;
}

export class GeminiLiveService {
  static getApiKey(): string | undefined {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
  }

  static isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  static getModelName(): string {
    return process.env.GEMINI_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
  }

  static getLiveModelName(): string {
    return process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
  }

  static getVoiceName(): string {
    return process.env.GEMINI_VOICE_NAME || 'Leda';
  }

  static getSystemInstruction(): string {
    return [
      'You are SentinelVoice, the voice copilot for SentinelBurn AI.',
      'Use telemetry and device evidence from SentinelBurn as your primary source of truth.',
      'Be concise, practical, and safety-aware.',
      'Before any irreversible disposition action, explicitly ask for confirmation and never act without user confirmation.',
      'If tools are available, call the SentinelBurn tool functions to answer questions grounded in run data, device status, alerts, telemetry, and reports.',
      'For navigation, fetch, or state-changing requests, use request_sentinel_action. Never execute an action directly. First present the pending action and ask for confirmation.',
      'When the user confirms or cancels, use confirm_sentinel_action or cancel_sentinel_action with the exact actionId from the pending action. Never invent or alter action arguments.',
      'When there is ambiguity, ask clarifying questions instead of guessing.'
    ].join(' ');
  }

  static getToolDeclarations() {
    return [{
      functionDeclarations: [
        {
          name: 'get_active_runs',
          description: 'List the active SentinelBurn burn-in runs and their status.',
          parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
          }
        },
        {
          name: 'get_device_status',
          description: 'Fetch the latest status for a SentinelBurn DUT by run and device ID.',
          parameters: {
            type: 'OBJECT',
            properties: {
              runId: { type: 'STRING' },
              deviceId: { type: 'STRING' }
            },
            required: ['runId', 'deviceId']
          }
        },
        {
          name: 'get_anomaly_summary',
          description: 'Summarize critical or warning devices in the active run.',
          parameters: {
            type: 'OBJECT',
            properties: {
              runId: { type: 'STRING' },
              threshold: { type: 'NUMBER' }
            },
            required: ['runId']
          }
        },
        {
          name: 'get_recent_alerts',
          description: 'Get recent anomaly alerts from a SentinelBurn run.',
          parameters: {
            type: 'OBJECT',
            properties: {
              runId: { type: 'STRING' },
              limit: { type: 'NUMBER' }
            },
            required: ['runId']
          }
        },
        {
          name: 'get_telemetry_snapshot',
          description: 'Get the latest telemetry snapshot for a DUT in a run.',
          parameters: {
            type: 'OBJECT',
            properties: {
              runId: { type: 'STRING' },
              deviceId: { type: 'STRING' }
            },
            required: ['runId', 'deviceId']
          }
        },
        {
          name: 'get_report_summary',
          description: 'Get the summary status for the official lot report in a run.',
          parameters: {
            type: 'OBJECT',
            properties: {
              runId: { type: 'STRING' }
            },
            required: ['runId']
          }
        },
        {
          name: 'get_current_run',
          description: 'Get the currently running SentinelBurn run, or the current registered run when none is running.',
          parameters: { type: 'OBJECT', properties: {}, required: [] }
        },
        {
          name: 'get_run_status',
          description: 'Get real run status, elapsed time, device count, and telemetry reporting coverage.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' } }, required: [] }
        },
        {
          name: 'get_run_summary',
          description: 'Analyze the current SentinelBurn run using real telemetry, anomaly scores, critical devices, trends, and ML explanation.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' } }, required: [] }
        },
        {
          name: 'get_active_devices',
          description: 'Return devices reporting real telemetry in a SentinelBurn run.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' } }, required: [] }
        },
        {
          name: 'get_live_telemetry',
          description: 'Return the latest real telemetry snapshots and sample counts for devices in a run.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' }, limit: { type: 'NUMBER' } }, required: [] }
        },
        {
          name: 'get_anomalies',
          description: 'Return real devices whose current anomaly score meets the requested threshold.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' }, threshold: { type: 'NUMBER' } }, required: [] }
        },
        {
          name: 'get_critical_devices',
          description: 'Return real devices with critical anomaly scores at or above 65.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' } }, required: [] }
        },
        {
          name: 'analyze_device',
          description: 'Analyze one real device with current readings, anomaly scores, recent trend, and ML explanation.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' }, deviceId: { type: 'STRING' } }, required: ['deviceId'] }
        },
        {
          name: 'get_shap_explanation',
          description: 'Retrieve the real ML/SHAP explanation for a device.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' }, deviceId: { type: 'STRING' } }, required: ['deviceId'] }
        },
        {
          name: 'compare_devices',
          description: 'Compare the real current scores and telemetry of two devices.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' }, deviceA: { type: 'STRING' }, deviceB: { type: 'STRING' } }, required: ['deviceA', 'deviceB'] }
        },
        {
          name: 'analyze_run_trends',
          description: 'Analyze real voltage, current, leakage, and temperature ranges across reporting devices.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' } }, required: [] }
        },
        {
          name: 'monitor_run',
          description: 'Start monitoring a SentinelBurn run for meaningful anomaly, severity, or telemetry coverage changes. Do not emit routine updates.',
          parameters: { type: 'OBJECT', properties: { runId: { type: 'STRING' } }, required: [] }
        },
        {
          name: 'request_sentinel_action',
          description: 'Create a server-validated pending SentinelBurn action. This never executes the action; it returns an actionId and confirmation preview.',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['OPEN_DEVICE', 'OPEN_RUN', 'OPEN_ALERTS', 'OPEN_CRITICAL_DEVICES', 'OPEN_TELEMETRY', 'OPEN_ANOMALY', 'OPEN_SHAP', 'OPEN_REPORT', 'FETCH_DEVICE_DETAILS', 'FETCH_TELEMETRY', 'DISPOSITION'] },
              runId: { type: 'STRING' },
              deviceId: { type: 'STRING' },
              decision: { type: 'STRING', enum: ['accept', 'reject', 'hold_fa'] },
              reason: { type: 'STRING' }
            },
            required: ['action']
          }
        },
        {
          name: 'confirm_sentinel_action',
          description: 'Confirm and execute the exact pending SentinelBurn action identified by actionId after verifying user/session ownership and expiry.',
          parameters: {
            type: 'OBJECT',
            properties: { actionId: { type: 'STRING' } },
            required: ['actionId']
          }
        },
        {
          name: 'cancel_sentinel_action',
          description: 'Cancel the exact pending SentinelBurn action identified by actionId.',
          parameters: {
            type: 'OBJECT',
            properties: { actionId: { type: 'STRING' } },
            required: ['actionId']
          }
        }
      ]
    }];
  }

  static getStatus(): GeminiLiveStatus {
    const configured = this.isConfigured();
    const model = this.getModelName();
    const liveModel = this.getLiveModelName();

    if (!configured) {
      return {
        configured: false,
        mode: 'fallback',
        model,
        liveModel,
        voiceName: this.getVoiceName(),
        message: 'Gemini Live is not configured. Set GEMINI_API_KEY to enable the real-time voice assistant.'
      };
    }

    return {
      configured: true,
      mode: 'gemini-live',
      model,
      liveModel,
      voiceName: this.getVoiceName(),
      message: 'Gemini Live is configured and ready for live voice and tool-based telemetry responses.'
    };
  }

  static async generateTextResponse(prompt: string): Promise<GeminiTextResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        mode: 'fallback',
        text: 'Gemini Live is not configured in this environment. Set GEMINI_API_KEY to enable live AI responses.'
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: this.getModelName(),
        contents: prompt
      });

      const text = response?.text?.trim() || 'Gemini responded without text content.';
      return {
        mode: 'live',
        text,
        model: this.getModelName()
      };
    } catch (error: any) {
      const message = error?.message || 'Unknown Gemini API error';
      return {
        mode: 'fallback',
        text: `Gemini API request failed: ${message}. The SentinelBurn rule-based copilot remains available for telemetry queries.`
      };
    }
  }

  static pcmToWav(pcmData: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
    const blockAlign = (channels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const buffer = Buffer.alloc(44 + pcmData.length);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + pcmData.length, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(pcmData.length, 40);
    pcmData.copy(buffer, 44);

    return buffer;
  }

  // Returns { pcmBase64, text } — raw signed-16-bit little-endian PCM at 24 kHz.
  // We deliberately skip WAV-header wrapping here because the client's
  // playGeminiAudio / pcm16ToFloat32 expects raw PCM bytes.  Wrapping the
  // payload in a WAV header and then decoding it as raw PCM caused the loud
  // noise burst (the 44-byte WAV header was treated as audio samples).
  static extractAudioPayloadFromMessage(message: any): { pcmBase64?: string; text?: string } {
    const serverContent = message?.serverContent;
    const modelTurn = serverContent?.modelTurn ?? serverContent ?? {};
    const parts = modelTurn.parts ?? [];

    const textParts = parts
      .filter((part: any) => part?.text)
      .map((part: any) => part.text)
      .join(' ')
      .trim();

    const audioInline = parts.find((part: any) => {
      const mime = part?.inlineData?.mimeType || '';
      return mime.toLowerCase().includes('audio');
    });

    if (!audioInline?.inlineData?.data) {
      return { text: textParts || undefined };
    }

    const base64 = String(audioInline.inlineData.data || '');
    const mimeType = String(audioInline.inlineData.mimeType || 'audio/L16');

    // If Gemini already returned a WAV (unusual), strip the 44-byte header so
    // we always hand raw PCM16 to the client.
    if (mimeType.toLowerCase().includes('wav') || mimeType.toLowerCase().includes('wave')) {
      const raw = Buffer.from(base64, 'base64');
      const pcmOnly = raw.slice(44); // strip the standard 44-byte WAV header
      return { pcmBase64: pcmOnly.toString('base64'), text: textParts || undefined };
    }

    // Already raw PCM — pass straight through.
    return { pcmBase64: base64, text: textParts || undefined };
  }

  static async executeToolCall(functionCall: any, context?: { userId: string; sessionId: string; userRole?: any; userName?: string; socket?: any }): Promise<any> {
    const name = functionCall?.name || '';
    const args = functionCall?.args || {};
    const currentRun = AnalysisService.getCurrentRun(args.runId);
    const runId = String(args.runId || currentRun?.id || 'run-isro-live-001');

    if (name === 'get_current_run') return AnalysisService.getRunStatus(currentRun?.id || runId);
    if (name === 'get_run_status') return AnalysisService.getRunStatus(runId);
    if (name === 'get_run_summary') return AnalysisService.analyzeRun(runId);
    if (name === 'get_active_devices') return AnalysisService.getLiveTelemetry(runId).map((item) => item.deviceId);
    if (name === 'get_live_telemetry') return AnalysisService.getLiveTelemetry(runId, Number(args.limit || 200));
    if (name === 'get_anomalies') return AnalysisService.getAnomalies(runId, Number(args.threshold || 40));
    if (name === 'get_critical_devices') return AnalysisService.getCriticalDevices(runId);
    if (name === 'analyze_run_trends') return AnalysisService.analyzeRunTrends(runId);
    if (name === 'monitor_run') {
      context?.socket?.emit('voice:monitor-start', runId);
      return { monitoring: true, runId, message: `Monitoring started for run ${runId}. I will report meaningful anomaly or coverage changes.` };
    }
    if (name === 'analyze_device') return AnalysisService.getDeviceAnalysis(runId, String(args.deviceId));
    if (name === 'get_shap_explanation') {
      const analysis = await AnalysisService.getDeviceAnalysis(runId, String(args.deviceId));
      return analysis.available ? analysis.explanation : analysis;
    }
    if (name === 'compare_devices') {
      const [deviceA, deviceB] = await Promise.all([
        AnalysisService.getDeviceAnalysis(runId, String(args.deviceA)),
        AnalysisService.getDeviceAnalysis(runId, String(args.deviceB))
      ]);
      return { runId, deviceA, deviceB };
    }

    if (name === 'request_sentinel_action') {
      const pending = ActionService.createPending({
        action: String(args.action || ''),
        args: { runId: String(args.runId || 'run-isro-live-001'), deviceId: args.deviceId, decision: args.decision, reason: args.reason },
        userId: context?.userId || context?.sessionId || 'voice-session',
        sessionId: context?.sessionId || 'voice-session',
        userRole: context?.userRole,
        userName: context?.userName
      });
      if ('error' in pending) return pending;
      context?.socket?.emit('voice:action-preview', pending);
      return { status: 'PENDING_CONFIRMATION', pendingAction: pending, message: `${pending.description} Would you like me to proceed?` };
    }

    if (name === 'confirm_sentinel_action') {
      const result = ActionService.confirm(String(args.actionId || ''), context?.userId || context?.sessionId || 'voice-session', context?.sessionId || 'voice-session', context?.userRole, context?.userName);
      context?.socket?.emit('voice:action-result', result);
      return result;
    }

    if (name === 'cancel_sentinel_action') {
      const result = ActionService.cancel(String(args.actionId || ''), context?.userId || context?.sessionId || 'voice-session', context?.sessionId || 'voice-session');
      context?.socket?.emit('voice:action-result', result);
      return result;
    }

    if (name === 'get_active_runs') {
      const runs = Array.from(db.runs.values()).map((run) => ({
        id: run.id,
        lotId: run.lotId,
        status: run.status,
        elapsedHours: run.elapsedHours,
        anomalyRate: run.anomalyInjectionConfig?.anomalyRate || 0
      }));
      return { runs };
    }

    if (name === 'get_device_status') {
      const runId = String(args.runId || 'run-isro-live-001');
      const deviceId = String(args.deviceId || 'd-0104');
      const device = db.devices.get(`${runId}:${deviceId}`);
      if (!device) {
        return { error: `Device ${deviceId} not found for run ${runId}.` };
      }
      return {
        deviceId: device.id,
        serial: device.deviceSerial,
        channelId: device.channelId,
        status: device.latestScores?.severity || 'nominal',
        anomalyClass: device.latestScores?.anomalyClassGuess || 'healthy',
        score: device.latestScores?.ensembleScore || 0,
        readings: device.latestReadings || {}
      };
    }

    if (name === 'get_anomaly_summary') {
      const runId = String(args.runId || 'run-isro-live-001');
      const threshold = Number(args.threshold || 65);
      const deviceIds = db.runDevices.get(runId) || [];
      const results = deviceIds
        .map((deviceId) => {
          const device = db.devices.get(`${runId}:${deviceId}`);
          const score = device?.latestScores?.ensembleScore || 0;
          return { deviceId, score, anomalyClass: device?.latestScores?.anomalyClassGuess || 'healthy' };
        })
        .filter((item) => item.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      return { results, threshold };
    }

    if (name === 'get_recent_alerts') {
      const runId = String(args.runId || 'run-isro-live-001');
      const limit = Number(args.limit || 5);
      const alerts = Array.from(db.alerts.values())
        .filter((alert) => alert.runId === runId)
        .slice(-limit)
        .map((alert) => ({
          id: alert.id,
          deviceId: alert.deviceId,
          severity: alert.severity,
          message: alert.message
        }));
      return { alerts };
    }

    if (name === 'get_telemetry_snapshot') {
      const runId = String(args.runId || 'run-isro-live-001');
      const deviceId = String(args.deviceId || 'd-0104');
      const history = db.getTelemetryHistory(runId, deviceId);
      const latest = history[history.length - 1];
      return {
        deviceId,
        runId,
        samples: history.length,
        latest: latest || null
      };
    }

    if (name === 'get_report_summary') {
      const runId = String(args.runId || 'run-isro-live-001');
      const run = db.runs.get(runId);
      return {
        runId,
        status: run?.status || 'unknown',
        lotId: run?.lotId || 'unknown',
        elapsedHours: run?.elapsedHours || 0,
        summary: `Run ${runId} is ${run?.status || 'unknown'} with ${db.runDevices.get(runId)?.length || 0} monitored DUT devices.`
      };
    }

    return { error: `Unsupported tool call: ${name}` };
  }

  static async createLiveSession(
    socket?: any,
    lifecycle: { intentionalClose: boolean } = { intentionalClose: false }
  ): Promise<{ connected: boolean; model: string; session?: any; error?: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        connected: false,
        model: this.getLiveModelName(),
        error: 'GEMINI_API_KEY is missing. Live sessions are disabled until the environment variable is set.'
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const liveModel = this.getLiveModelName();
      const session = await ai.live.connect({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.getVoiceName(),
              },
            },
          },
          inputAudioTranscription: { languageCodes: ['en-US'] },
          outputAudioTranscription: { languageCodes: ['en-US'] },
          systemInstruction: {
            role: 'user',
            parts: [{ text: this.getSystemInstruction() }]
          },
          tools: this.getToolDeclarations() as any
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live connected.');
            socket?.emit('voice:state', 'LISTENING');
          },
          onmessage: async (event: any) => {
            if (event?.toolCall?.functionCalls?.length) {
              const responses = await Promise.all(
                event.toolCall.functionCalls.map(async (call: any) => {
                  const result = await this.executeToolCall(call, {
                    userId: socket?.data?.userId || socket?.id || 'voice-session',
                    sessionId: socket?.id || 'voice-session',
                    userRole: socket?.data?.userRole,
                    userName: socket?.data?.userName,
                    socket
                  });
                  return {
                    id: call.id,
                    name: call.name,
                    response: { output: result }
                  };
                })
              );

              session.sendToolResponse({ functionResponses: responses });
              socket?.emit('voice:tool-call', { calls: responses });
              return;
            }

            const payload = this.extractAudioPayloadFromMessage(event);
            const interrupted = Boolean(event?.serverContent?.interrupted);
            const turnComplete = Boolean(event?.serverContent?.turnComplete);
            const inputTranscription = event?.serverContent?.inputTranscription?.text;
            const interimInputTranscription = event?.serverContent?.interimInputTranscription?.text;
            const outputTranscription = event?.serverContent?.outputTranscription?.text;
            if (inputTranscription) {
              socket?.emit('voice:transcript', { text: inputTranscription, source: 'user', interim: false });
            } else if (interimInputTranscription) {
              socket?.emit('voice:transcript', { text: interimInputTranscription, source: 'user', interim: true });
            }
            if (outputTranscription) {
              socket?.emit('voice:transcript', { text: outputTranscription, source: 'gemini', interim: false });
            }
            if (payload.text) {
              socket?.emit('voice:transcript', { text: payload.text, source: 'gemini' });
            }

            // Send raw PCM16 base64 (no WAV header) so the client can decode
            // it directly with pcm16ToFloat32 → AudioBuffer without noise.
            if (payload.pcmBase64) {
              socket?.emit('voice:response', {
                audioBase64: payload.pcmBase64,
                text: payload.text || '',
                turnComplete,
                interrupted
              });
            } else if (payload.text) {
              socket?.emit('voice:response', {
                text: payload.text,
                turnComplete,
                interrupted
              });
            } else if (turnComplete || interrupted) {
              socket?.emit('voice:response', { turnComplete, interrupted });
            }

            if (turnComplete || interrupted) {
              socket?.emit('voice:state', 'LISTENING');
            }
          },
          onerror: (error: any) => {
            console.error('Gemini Live error:', {
              message: error?.message,
              code: error?.code,
              status: error?.status,
              details: error
            });
            socket?.emit('voice:error', { message: error?.message || 'Gemini Live connection error.' });
            socket?.emit('voice:state', 'ERROR');
          },
          onclose: (event: any) => {
            console.log('Gemini Live session closed.', {
              code: event?.code,
              reason: event?.reason,
              intentional: lifecycle.intentionalClose
            });
            if (lifecycle.intentionalClose) {
              return;
            }
            socket?.emit('voice:state', 'RECONNECTING');
            socket?.emit('voice:disconnected', {
              code: event?.code,
              reason: event?.reason || 'Gemini Live session closed unexpectedly.'
            });
          }
        }
      });

      return {
        connected: true,
        model: liveModel,
        session
      };
    } catch (error: any) {
      return {
        connected: false,
        model: this.getLiveModelName(),
        error: error?.message || 'Gemini Live connection failed.'
      };
    }
  }
}
