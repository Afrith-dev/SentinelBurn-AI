import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  Volume2,
  VolumeX,
  X,
  Minus,
  Send,
  GripHorizontal,
  Sparkles,
  ShieldAlert,
  Radio,
  Maximize2,
  PhoneOff,
} from 'lucide-react';

import { copilotApi } from '../services/api';
import { getSocket } from '../services/socket';
import { AudioVisualizer } from './AudioVisualizer';
import { useAuthStore } from '../store/authStore';
import { useRunStore } from '../store/runStore';

interface MessageLog {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  isConfirmation?: boolean;
}

type VoiceState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'CONNECTING'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'RECONNECTING'
  | 'ERROR';

interface GeminiStatus {
  configured: boolean;
  mode: string;
  message: string;
  model: string;
  liveModel: string;
}

interface PendingConfirmation {
  actionId: string;
  description?: string;
  risk?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  [key: string]: any;
}

const stateLabelMap: Record<VoiceState, string> = {
  IDLE: 'IDLE',
  REQUESTING_PERMISSION: 'REQUESTING PERMISSION',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR',
};

const CAPTURE_SAMPLE_RATE = 16000;
const GEMINI_OUTPUT_SAMPLE_RATE = 24000;

let dcFilterPrevIn = 0;
let dcFilterPrevOut = 0;

const floatTo16BitPCM = (samples: Float32Array): Uint8Array => {
  const buffer = new Int16Array(samples.length);
  // Single-pole DC blocker (R = 0.995): removes DC bias & low-frequency pop noise
  const R = 0.995;

  for (let i = 0; i < samples.length; i += 1) {
    const input = samples[i];
    const filtered = input - dcFilterPrevIn + R * dcFilterPrevOut;
    dcFilterPrevIn = input;
    dcFilterPrevOut = filtered;

    const clamped = Math.max(-1, Math.min(1, filtered));
    buffer[i] = clamped < 0
      ? clamped * 0x8000
      : clamped * 0x7fff;
  }

  return new Uint8Array(buffer.buffer);
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const pcm16ToFloat32 = (bytes: Uint8Array): Float32Array => {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const samples = new Float32Array(sampleCount);

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );

  for (let i = 0; i < sampleCount; i += 1) {
    const sample = view.getInt16(i * 2, true);

    samples[i] = sample < 0
      ? sample / 0x8000
      : sample / 0x7fff;
  }

  // Crossfade ramp on chunk boundaries (32 samples = ~1.3ms at 24kHz)
  // Eliminates high-frequency pop/click noise from raw PCM chunk concatenation
  const rampLength = Math.min(32, Math.floor(sampleCount / 4));
  for (let i = 0; i < rampLength; i += 1) {
    const factor = 0.5 * (1 - Math.cos((Math.PI * i) / rampLength));
    samples[i] *= factor;
    samples[sampleCount - 1 - i] *= factor;
  }

  return samples;
};

export const VoiceCopilot: React.FC = () => {
  const navigate = useNavigate();

  const { user } = useAuthStore();
  const { activeRun } = useRunStore();

  // ---------------------------------------------------------
  // UI STATE
  // ---------------------------------------------------------

  const [position, setPosition] = useState({
    x: Math.max(10, window.innerWidth - 420),
    y: Math.max(10, window.innerHeight - 560),
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [inputText, setInputText] = useState('');
  const [transcript, setTranscript] = useState('');

  const [voiceState, setVoiceState] =
    useState<VoiceState>('IDLE');

  const [voiceError, setVoiceError] = useState('');

  const [geminiStatus, setGeminiStatus] =
    useState<GeminiStatus>({
      configured: false,
      mode: 'fallback',
      message: 'Checking Gemini Live configuration…',
      model: '',
      liveModel: '',
    });

  const [messages, setMessages] = useState<MessageLog[]>([
    {
      id: 'msg-welcome',
      sender: 'copilot',
      text:
        'SentinelVoice is online. Use the live mic for Gemini Live, or type a query in the chat fallback at any time.',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);

  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);

  // ---------------------------------------------------------
  // DRAGGING
  // ---------------------------------------------------------

  const dragStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    initX: 0,
    initY: 0,
  });

  // ---------------------------------------------------------
  // AUDIO
  // ---------------------------------------------------------

  const captureAudioContextRef =
    useRef<AudioContext | null>(null);

  const playbackAudioContextRef =
    useRef<AudioContext | null>(null);

  const analyserRef =
    useRef<AnalyserNode | null>(null);

  const micStreamRef =
    useRef<MediaStream | null>(null);

  const processorRef =
    useRef<ScriptProcessorNode | null>(null);

  const sourceNodeRef =
    useRef<MediaStreamAudioSourceNode | null>(null);

  const captureGainRef =
    useRef<GainNode | null>(null);

  const playbackSourcesRef =
    useRef<Set<AudioBufferSourceNode>>(new Set());

  const playbackSourceRef =
    useRef<AudioBufferSourceNode | null>(null);

  const activePlaybackCountRef =
    useRef(0);

  const nextPlaybackTimeRef =
    useRef(0);

  const captureEnabledRef =
    useRef(false);

  const isMutedRef =
    useRef(false);

  // ---------------------------------------------------------
  // SOCKET / SESSION
  // ---------------------------------------------------------

  const socketRef = useRef<any>(null);

  const streamingCopilotMessageIdRef =
    useRef<string | null>(null);

  const copilotSessionIdRef =
    useRef(
      `copilot-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`
    );

  const messagesEndRef =
    useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------
  // KEEP MUTE REF IN SYNC
  // ---------------------------------------------------------

  useEffect(() => {
    isMutedRef.current = isMuted;

    if (isMuted) {
      stopPlayback();
      // Also cancel any speech-synthesis TTS that may be playing (text fallback mode)
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
  }, [isMuted]);

  // ---------------------------------------------------------
  // MESSAGE HELPERS
  // ---------------------------------------------------------

  const appendMessage = (
    sender: 'user' | 'copilot',
    text: string
  ) => {
    if (!text?.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`,
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
  };

  const appendStreamingCopilotText = (
    chunk: string
  ) => {
    if (!chunk) return;

    setMessages((prev) => {
      const activeId =
        streamingCopilotMessageIdRef.current;

      const activeMessage = activeId
        ? prev.find(
            (message) => message.id === activeId
          )
        : undefined;

      if (activeMessage) {
        const needsSeparator =
          !/\s$/.test(activeMessage.text) &&
          !/^\s/.test(chunk) &&
          /[A-Za-z0-9]$/.test(activeMessage.text) &&
          /^[A-Za-z0-9]/.test(chunk);

        return prev.map((message) =>
          message.id === activeId
            ? {
                ...message,
                text:
                  message.text +
                  (needsSeparator ? ' ' : '') +
                  chunk,
              }
            : message
        );
      }

      const id = `msg-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

      streamingCopilotMessageIdRef.current = id;

      return [
        ...prev,
        {
          id,
          sender: 'copilot',
          text: chunk,
          timestamp: new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          ),
        },
      ];
    });
  };

  const finishStreamingCopilotMessage = () => {
    streamingCopilotMessageIdRef.current = null;
  };

  // ---------------------------------------------------------
  // AUDIO CONTEXTS
  // ---------------------------------------------------------

  const ensureCaptureAudioContext =
    async (): Promise<AudioContext> => {
      const AudioCtx =
        window.AudioContext ||
        (window as any).webkitAudioContext;

      if (!AudioCtx) {
        throw new Error(
          'Web Audio API is not available in this browser.'
        );
      }

      if (!captureAudioContextRef.current) {
        captureAudioContextRef.current =
          new AudioCtx({
            sampleRate: CAPTURE_SAMPLE_RATE,
          });

        analyserRef.current =
          captureAudioContextRef.current.createAnalyser();

        analyserRef.current.fftSize = 64;
      }

      if (
        captureAudioContextRef.current.state ===
        'suspended'
      ) {
        await captureAudioContextRef.current.resume();
      }

      return captureAudioContextRef.current;
    };

  const ensurePlaybackAudioContext =
    async (): Promise<AudioContext> => {
      const AudioCtx =
        window.AudioContext ||
        (window as any).webkitAudioContext;

      if (!AudioCtx) {
        throw new Error(
          'Web Audio API is not available in this browser.'
        );
      }

      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current =
          new AudioCtx({
            sampleRate: GEMINI_OUTPUT_SAMPLE_RATE,
          });
      }

      if (
        playbackAudioContextRef.current.state ===
        'suspended'
      ) {
        await playbackAudioContextRef.current.resume();
      }

      return playbackAudioContextRef.current;
    };

  // ---------------------------------------------------------
  // STOP GEMINI PLAYBACK
  // ---------------------------------------------------------

  const stopPlayback = () => {
    for (const source of playbackSourcesRef.current) {
      try {
        source.onended = null;
        source.stop();
      } catch (_) {
        // Already stopped.
      }

      try {
        source.disconnect();
      } catch (_) {
        // Already disconnected.
      }
    }

    playbackSourcesRef.current.clear();

    activePlaybackCountRef.current = 0;

    nextPlaybackTimeRef.current = 0;

    playbackSourceRef.current = null;

    if (
      playbackAudioContextRef.current &&
      playbackAudioContextRef.current.state ===
        'running'
    ) {
      // Do not suspend here.
      // Keeping the context running avoids latency
      // when the next Gemini chunk arrives.
    }
  };

  // ---------------------------------------------------------
  // PLAY RAW GEMINI PCM16 AUDIO
  // ---------------------------------------------------------

  const playGeminiAudio = async (
    base64Audio: string
  ) => {
    if (!base64Audio || isMutedRef.current) {
      return;
    }

    try {
      const audioContext =
        await ensurePlaybackAudioContext();

      if (isMutedRef.current) {
        return;
      }

      const bytes =
        base64ToUint8Array(base64Audio);

      if (bytes.byteLength < 2) {
        return;
      }

      // Gemini Live audio is raw signed 16-bit PCM.
      const floatSamples =
        pcm16ToFloat32(bytes);

      if (floatSamples.length === 0) {
        return;
      }

      const audioBuffer =
        audioContext.createBuffer(
          1,
          floatSamples.length,
          GEMINI_OUTPUT_SAMPLE_RATE
        );

      audioBuffer.getChannelData(0).set(floatSamples);

      const source =
        audioContext.createBufferSource();

      source.buffer = audioBuffer;

      source.connect(audioContext.destination);

      playbackSourcesRef.current.add(source);

      activePlaybackCountRef.current += 1;

      const now = audioContext.currentTime;

      // Jitter buffer scheduling:
      // When starting a new utterance turn, buffer 35ms ahead to absorb network jitter.
      // If queue is already playing, schedule exactly at nextPlaybackTime to avoid gaps!
      let startAt: number;
      if (nextPlaybackTimeRef.current <= now) {
        startAt = now + 0.035;
      } else {
        startAt = nextPlaybackTimeRef.current;
      }

      nextPlaybackTimeRef.current =
        startAt + audioBuffer.duration;

      playbackSourceRef.current = source;

      setVoiceState('SPEAKING');

      source.onended = () => {
        playbackSourcesRef.current.delete(
          source
        );

        activePlaybackCountRef.current =
          Math.max(
            0,
            activePlaybackCountRef.current - 1
          );

        try {
          source.disconnect();
        } catch (_) {
          // Already disconnected.
        }

        if (
          playbackSourceRef.current === source
        ) {
          playbackSourceRef.current = null;
        }

        if (
          activePlaybackCountRef.current === 0
        ) {
          nextPlaybackTimeRef.current = 0;

          if (
            captureEnabledRef.current
          ) {
            setVoiceState('LISTENING');
          }
        }
      };

      source.start(startAt);
    } catch (error) {
      console.warn(
        'Unable to play Gemini PCM audio:',
        error
      );

      if (captureEnabledRef.current) {
        setVoiceState('LISTENING');
      }
    }
  };

  // ---------------------------------------------------------
  // MICROPHONE CAPTURE
  // ---------------------------------------------------------

  const disconnectMicCapture = () => {
    captureEnabledRef.current = false;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess =
        null;
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (captureGainRef.current) {
      captureGainRef.current.disconnect();
      captureGainRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      micStreamRef.current = null;
    }

    socketRef.current?.emit(
      'voice:audio-end'
    );
  };

  const startCapture = async (): Promise<boolean> => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
    }

    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          'Microphone access is not supported by this browser.'
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      micStreamRef.current = stream;

      const context =
        await ensureCaptureAudioContext();

      const source =
        context.createMediaStreamSource(stream);

      sourceNodeRef.current = source;

      const analyser = analyserRef.current;

      if (analyser) {
        source.connect(analyser);
      }

      const processor =
        context.createScriptProcessor(
          2048,
          1,
          1
        );

      processorRef.current = processor;

      const gainNode =
        context.createGain();

      gainNode.gain.value = 0;

      captureGainRef.current = gainNode;

      source.connect(processor);

      processor.connect(gainNode);

      gainNode.connect(
        context.destination
      );

      processor.onaudioprocess = (
        event
      ) => {
        if (
          !captureEnabledRef.current
        ) {
          return;
        }

        const input =
          event.inputBuffer.getChannelData(
            0
          );

        const pcm =
          floatTo16BitPCM(input);

        if (
          pcm.length > 0 &&
          socketRef.current
        ) {
          socketRef.current.emit(
            'voice:audio',
            Array.from(pcm)
          );
        }
      };

      return true;
    } catch (error: any) {
      console.warn(
        'Microphone permission error:',
        error
      );

      setVoiceState('ERROR');

      setVoiceError(
        error?.message ||
          'Microphone access denied.'
      );

      disconnectMicCapture();

      return false;
    }
  };

  // ---------------------------------------------------------
  // START GEMINI LIVE
  // ---------------------------------------------------------

  const startLiveVoiceSession =
    async () => {
      if (!socketRef.current) {
        socketRef.current = getSocket();
      }

      setVoiceError('');

      setVoiceState(
        'REQUESTING_PERMISSION'
      );

      stopPlayback();

      const captureStarted =
        await startCapture();

      if (!captureStarted) {
        return;
      }

      if (!micStreamRef.current) {
        setVoiceState('ERROR');
        setVoiceError(
          'Microphone stream could not be started.'
        );
        return;
      }

      setVoiceState('CONNECTING');

      captureEnabledRef.current = true;

      socketRef.current.emit(
        'voice:connect'
      );
    };

  // ---------------------------------------------------------
  // END GEMINI LIVE
  // ---------------------------------------------------------

  const endLiveVoiceSession = () => {
    captureEnabledRef.current = false;

    stopPlayback();

    disconnectMicCapture();

    socketRef.current?.emit(
      'voice:disconnect-session'
    );

    finishStreamingCopilotMessage();

    setTranscript('');

    setVoiceState('IDLE');

    setVoiceError('');
  };

  const handleCloseAndDisconnect = () => {
    endLiveVoiceSession();
    setIsOpen(false);
  };

  // ---------------------------------------------------------
  // TEXT / FALLBACK QUERY
  // ---------------------------------------------------------

  const handleUserQuery = async (
    queryText: string,
    pendingActionId?: string
  ) => {
    const trimmedQuery =
      queryText.trim();

    if (!trimmedQuery) {
      return;
    }

    appendMessage(
      'user',
      trimmedQuery
    );

    setVoiceState('PROCESSING');

    setTranscript('');

    try {
      const response =
        await copilotApi.query({
          query: trimmedQuery,
          runId:
            activeRun?.id ||
            'run-isro-live-001',
          pendingActionId:
            pendingActionId ||
            pendingConfirmation?.actionId,
          sessionId:
            copilotSessionIdRef.current,
        });

      if (response?.message) {
        appendMessage(
          'copilot',
          response.message
        );
      }

      if (
        response?.requiresConfirmation
      ) {
        setPendingConfirmation(
          response.confirmationPayload
        );
      } else {
        setPendingConfirmation(null);
      }

      if (
        response?.spokenText &&
        !isMutedRef.current
      ) {
        const utterance =
          new SpeechSynthesisUtterance(
            response.spokenText
          );

        utterance.rate = 1.05;

        window.speechSynthesis.cancel();

        window.speechSynthesis.speak(
          utterance
        );
      }

      if (
        response?.navigationUrl &&
        !response?.requiresConfirmation
      ) {
        navigate(
          response.navigationUrl
        );
      }

      if (
        response?.data
          ?.monitoringRequested
      ) {
        socketRef.current?.emit(
          'voice:monitor-start',
          activeRun?.id ||
            'run-isro-live-001'
        );
      }
    } catch (error: any) {
      appendMessage(
        'copilot',
        'Telemetry query error: ' +
          (error?.message ||
            'Check backend connectivity.')
      );
    } finally {
      setVoiceState(
        captureEnabledRef.current
          ? 'LISTENING'
          : 'IDLE'
      );
    }
  };

  // ---------------------------------------------------------
  // SCROLL CHAT
  // ---------------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, transcript]);

  // ---------------------------------------------------------
  // GEMINI STATUS
  // ---------------------------------------------------------

  useEffect(() => {
    copilotApi
      .getGeminiStatus()
      .then((status) => {
        setGeminiStatus(status);
      })
      .catch(() => {
        setGeminiStatus({
          configured: false,
          mode: 'fallback',
          message:
            'Gemini status unavailable. Fallback telemetry copilot remains active.',
          model: '',
          liveModel: '',
        });
      });
  }, []);

  // ---------------------------------------------------------
  // WINDOW RESIZE
  // ---------------------------------------------------------

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.max(
          10,
          Math.min(
            prev.x,
            window.innerWidth - 390
          )
        ),
        y: Math.max(
          10,
          Math.min(
            prev.y,
            window.innerHeight - 120
          )
        ),
      }));
    };

    window.addEventListener(
      'resize',
      handleResize
    );

    return () => {
      window.removeEventListener(
        'resize',
        handleResize
      );
    };
  }, []);

  // ---------------------------------------------------------
  // SOCKET LISTENERS
  // ---------------------------------------------------------

  useEffect(() => {
    const socket = getSocket();

    socketRef.current = socket;

    const handleConnected = ({
      model,
    }: {
      model?: string;
    }) => {
      finishStreamingCopilotMessage();

      setGeminiStatus((prev) => ({
        ...prev,
        configured: true,
        liveModel:
          model ||
          prev.liveModel,
        message:
          'Gemini Live session connected.',
      }));

      setVoiceError('');

      setVoiceState('LISTENING');
    };

    const handleVoiceState = (
      nextState: VoiceState
    ) => {
      setVoiceState(nextState);
    };

    const handleVoiceError = ({
      message,
    }: {
      message?: string;
    }) => {
      finishStreamingCopilotMessage();

      setVoiceError(
        message ||
          'Gemini Live failed.'
      );

      setVoiceState('ERROR');

      appendMessage(
        'copilot',
        message ||
          'Gemini Live failed.'
      );
    };

    const handleTranscript = ({
      text,
      source,
      interim,
    }: {
      text?: string;
      source?: string;
      interim?: boolean;
    }) => {
      if (!text) {
        return;
      }

      if (source === 'gemini') {
        appendStreamingCopilotText(
          text
        );
        return;
      }

      if (interim) {
        setTranscript(text);
        return;
      }

      appendMessage('user', text);

      setTranscript('');
    };

    const handleActionPreview = (
      pendingAction: PendingConfirmation
    ) => {
      setPendingConfirmation(
        pendingAction
      );
    };

    const handleActionResult = (
      result: any
    ) => {
      if (result?.message) {
        appendMessage(
          'copilot',
          result.message
        );
      }

      setPendingConfirmation(null);

      if (result?.navigationUrl) {
        navigate(
          result.navigationUrl
        );
      }
    };

    const handleMonitorUpdate = ({
      message,
    }: {
      message?: string;
    }) => {
      if (message) {
        appendMessage(
          'copilot',
          message
        );
      }
    };

    const handleVoiceResponse = async ({
      text,
      audioBase64,
      turnComplete,
      interrupted,
    }: {
      text?: string;
      audioBase64?: string;
      turnComplete?: boolean;
      interrupted?: boolean;
    }) => {
      if (interrupted) {
        stopPlayback();
      }

      if (text) {
        appendStreamingCopilotText(
          text
        );
      }

      if (
        audioBase64 &&
        !isMutedRef.current
      ) {
        await playGeminiAudio(
          audioBase64
        );
      }

      if (
        interrupted ||
        turnComplete
      ) {
        finishStreamingCopilotMessage();

        if (
          captureEnabledRef.current
        ) {
          setVoiceState(
            'LISTENING'
          );
        }
      }
    };

    const handleDisconnected = () => {
      finishStreamingCopilotMessage();

      if (
        captureEnabledRef.current
      ) {
        setVoiceState(
          'RECONNECTING'
        );

        setVoiceError(
          'Gemini connection lost. Reconnecting…'
        );
      }
    };

    socket.on(
      'voice:connected',
      handleConnected
    );

    socket.on(
      'voice:state',
      handleVoiceState
    );

    socket.on(
      'voice:error',
      handleVoiceError
    );

    socket.on(
      'voice:transcript',
      handleTranscript
    );

    socket.on(
      'voice:action-preview',
      handleActionPreview
    );

    socket.on(
      'voice:action-result',
      handleActionResult
    );

    socket.on(
      'voice:monitor-update',
      handleMonitorUpdate
    );

    socket.on(
      'voice:response',
      handleVoiceResponse
    );

    socket.on(
      'voice:disconnected',
      handleDisconnected
    );

    return () => {
      socket.off(
        'voice:connected',
        handleConnected
      );

      socket.off(
        'voice:state',
        handleVoiceState
      );

      socket.off(
        'voice:error',
        handleVoiceError
      );

      socket.off(
        'voice:transcript',
        handleTranscript
      );

      socket.off(
        'voice:action-preview',
        handleActionPreview
      );

      socket.off(
        'voice:action-result',
        handleActionResult
      );

      socket.off(
        'voice:monitor-update',
        handleMonitorUpdate
      );

      socket.off(
        'voice:response',
        handleVoiceResponse
      );

      socket.off(
        'voice:disconnected',
        handleDisconnected
      );
    };
  }, [navigate]);

  // ---------------------------------------------------------
  // CLEANUP ON UNMOUNT
  // ---------------------------------------------------------

  useEffect(() => {
    return () => {
      captureEnabledRef.current =
        false;

      stopPlayback();

      if (
        processorRef.current
      ) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess =
          null;
      }

      if (
        sourceNodeRef.current
      ) {
        sourceNodeRef.current.disconnect();
      }

      if (
        captureGainRef.current
      ) {
        captureGainRef.current.disconnect();
      }

      if (micStreamRef.current) {
        micStreamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      socketRef.current?.emit(
        'voice:audio-end'
      );

      socketRef.current?.emit(
        'voice:disconnect-session'
      );

      try {
        window.speechSynthesis.cancel();
      } catch (_) {
        // Ignore speech synthesis cleanup errors.
      }

      if (
        captureAudioContextRef.current
      ) {
        captureAudioContextRef.current
          .close()
          .catch(() => {});
      }

      if (
        playbackAudioContextRef.current
      ) {
        playbackAudioContextRef.current
          .close()
          .catch(() => {});
      }
    };
  }, []);

  // ---------------------------------------------------------
  // DRAGGING
  // ---------------------------------------------------------

  const handlePointerDown = (
    event: React.PointerEvent
  ) => {
    setIsDragging(true);

    dragStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      initX: position.x,
      initY: position.y,
    };

    try {
      (
        event.currentTarget as HTMLElement
      ).setPointerCapture(
        event.pointerId
      );
    } catch (_) {
      // Pointer capture unavailable.
    }
  };

  const handlePointerMove = (
    event: React.PointerEvent
  ) => {
    if (!isDragging) {
      return;
    }

    const dx =
      event.clientX -
      dragStartRef.current.mouseX;

    const dy =
      event.clientY -
      dragStartRef.current.mouseY;

    const newX = Math.max(
      10,
      Math.min(
        window.innerWidth - 390,
        dragStartRef.current.initX +
          dx
      )
    );

    const newY = Math.max(
      10,
      Math.min(
        window.innerHeight - 120,
        dragStartRef.current.initY +
          dy
      )
    );

    setPosition({
      x: newX,
      y: newY,
    });
  };

  const handlePointerUp = (
    event: React.PointerEvent
  ) => {
    setIsDragging(false);

    try {
      (
        event.currentTarget as HTMLElement
      ).releasePointerCapture(
        event.pointerId
      );
    } catch (_) {
      // Pointer capture already released.
    }
  };

  // ---------------------------------------------------------
  // MIC BUTTON
  // ---------------------------------------------------------

  const handleListenToggle =
    async () => {
      const activeStates: VoiceState[] =
        [
          'LISTENING',
          'PROCESSING',
          'CONNECTING',
          'REQUESTING_PERMISSION',
          'SPEAKING',
          'RECONNECTING',
        ];

      if (
        activeStates.includes(
          voiceState
        )
      ) {
        endLiveVoiceSession();
        return;
      }

      if (
        voiceState === 'ERROR'
      ) {
        setVoiceError('');
      }

      await startLiveVoiceSession();
    };

  // ---------------------------------------------------------
  // CONFIRM / CANCEL ACTION
  // ---------------------------------------------------------

  const handleConfirmAction = (
    confirm: boolean
  ) => {
    const actionId =
      pendingConfirmation?.actionId;

    if (!actionId) {
      return;
    }

    const confirmationText =
      confirm
        ? 'Confirm'
        : 'Cancel';

    if (
      socketRef.current?.connected &&
      voiceState !== 'IDLE' &&
      voiceState !== 'ERROR'
    ) {
      socketRef.current.emit(
        'voice:text',
        confirmationText
      );

      return;
    }

    if (confirm) {
      handleUserQuery(
        'Confirm',
        actionId
      );
    } else {
      handleUserQuery(
        'Cancel',
        actionId
      );
    }
  };

  const statusText =
    voiceError ||
    geminiStatus.message ||
    'Gemini Live Ready';

  // ---------------------------------------------------------
  // MINIMIZED BUTTON & LIVE WHILE MINIMIZED PILL
  // ---------------------------------------------------------

  if (!isOpen) {
    const isLive = voiceState !== 'IDLE' && voiceState !== 'ERROR';

    if (isLive) {
      return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Subtitle / Transcript Preview Bubble */}
          {(transcript || (messages.length > 0 && messages[messages.length - 1].sender === 'copilot')) && (
            <div
              onClick={() => setIsOpen(true)}
              className="max-w-xs px-3 py-1.5 rounded-xl bg-space-900/95 border border-cyber-cyan/40 text-[11px] font-mono text-slate-200 shadow-xl backdrop-blur-md truncate cursor-pointer hover:border-cyber-cyan transition-colors"
            >
              <span className="text-cyber-cyan font-bold mr-1.5">
                {voiceState === 'SPEAKING' ? 'Leda:' : 'Live:'}
              </span>
              {transcript || messages[messages.length - 1]?.text}
            </div>
          )}

          {/* Floating Glowing Live Pill */}
          <div className="flex items-center gap-2 p-1.5 pl-3.5 rounded-full bg-space-900/95 border-2 border-cyber-cyan shadow-cyan-glow backdrop-blur-xl">
            {/* Status Indicator & Live Bars */}
            <div
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer pr-1 select-none"
              title="Click to expand SentinelVoice"
            >
              <div className="relative flex items-center justify-center">
                <span className={`w-3 h-3 rounded-full ${
                  voiceState === 'SPEAKING' ? 'bg-amber-400 animate-ping' :
                  voiceState === 'LISTENING' ? 'bg-cyber-cyan animate-ping' : 'bg-violet-400 animate-pulse'
                }`} />
                <span className={`absolute w-2 h-2 rounded-full ${
                  voiceState === 'SPEAKING' ? 'bg-amber-400' :
                  voiceState === 'LISTENING' ? 'bg-cyber-cyan' : 'bg-violet-400'
                }`} />
              </div>

              {/* Animated mini sound bars */}
              <div className="flex items-center gap-0.5 h-4">
                <span className={`w-1 rounded-full ${voiceState === 'SPEAKING' ? 'bg-amber-400 animate-bounce' : 'bg-cyber-cyan'} h-2`} />
                <span className={`w-1 rounded-full ${voiceState === 'SPEAKING' ? 'bg-amber-400 animate-pulse' : 'bg-cyber-cyan'} h-4`} />
                <span className={`w-1 rounded-full ${voiceState === 'SPEAKING' ? 'bg-amber-400 animate-bounce' : 'bg-cyber-cyan'} h-3`} />
                <span className={`w-1 rounded-full ${voiceState === 'SPEAKING' ? 'bg-amber-400 animate-pulse' : 'bg-cyber-cyan'} h-2`} />
              </div>

              <div className="text-left font-mono">
                <div className="text-[10px] font-extrabold tracking-wider bg-gradient-to-r from-white to-cyber-cyan bg-clip-text text-transparent uppercase">
                  {voiceState === 'SPEAKING' ? 'SPEAKING (Leda)' : voiceState}
                </div>
                <div className="text-[8px] text-slate-400 leading-none">
                  Live while minimized · Tap to open
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 pl-1.5 border-l border-slate-700/80">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(prev => !prev);
                }}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-cyber-cyan" />
                )}
              </button>

              <button
                onClick={() => setIsOpen(true)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Expand panel"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseAndDisconnect();
                }}
                className="p-1.5 rounded-full hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="End Voice Session"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed bottom-6 right-6 z-50 group">
        <button
          onClick={() =>
            setIsOpen(true)
          }
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-space-900 via-space-850 to-space-950 border-2 border-cyber-cyan/60 shadow-cyan-glow hover:border-cyber-cyan hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer"
          title="Open SentinelVoice Copilot"
          aria-label="Open SentinelVoice Copilot"
        >
          <span className="absolute inset-0 rounded-full border border-cyber-cyan/30 animate-ping opacity-30 pointer-events-none" />

          <div className="relative flex items-center justify-center pointer-events-none">
            <Radio className="w-6 h-6 text-cyber-cyan group-hover:rotate-12 transition-transform duration-300 animate-pulse" />

            <Sparkles className="w-3 h-3 text-amber-400 absolute -top-1.5 -right-1.5 animate-bounce" />
          </div>

          <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-space-950 shadow-sm" />
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------
  // COPILOT PANEL
  // ---------------------------------------------------------

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className="fixed z-50 w-96 rounded-2xl bg-space-900/95 border border-slate-700/90 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* HEADER */}
      <div
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        className="px-4 py-3 bg-gradient-to-r from-space-950 via-space-900 to-space-950 border-b border-slate-800 flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-500" />

          <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />

          <div>
            <div className="text-xs font-mono font-extrabold tracking-wider bg-gradient-to-r from-white via-slate-200 to-cyber-cyan bg-clip-text text-transparent">
              SENTINEL
              <span className="text-cyber-cyan">
                VOICE
              </span>{' '}
              COPILOT
            </div>

            <div
              className="text-[9px] font-mono text-slate-400"
              title={statusText}
            >
              {user?.role
                ?.toUpperCase()
                .replace(
                  '_',
                  ' '
                )}{' '}
              ·{' '}
              {geminiStatus.configured
                ? 'Gemini Live Ready'
                : 'Telemetry Fallback Mode'}
            </div>
          </div>
        </div>

        {/* Stop pointer events from bubbling to the drag handler.
            Without this, onPointerDown on the header calls setPointerCapture()
            which redirects all subsequent pointerup events away from the
            child buttons — click never fires and the buttons appear broken. */}
        <div
          className="flex items-center gap-1.5 text-slate-400"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-cyber-cyan" />
            )}
          </button>

          <button
            onClick={() => setIsOpen(false)}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Minimize to Live Pill"
            aria-label="Minimize to Live Pill"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCloseAndDisconnect}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Close & Disconnect Voice"
            aria-label="Close & Disconnect Voice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AUDIO VISUALIZER */}
      <div className="px-4 pt-3 pb-2 bg-space-950/60 border-b border-slate-800/60 flex flex-col items-center">
        <AudioVisualizer
          isListening={
            voiceState === 'LISTENING'
          }
          isSpeaking={
            voiceState === 'SPEAKING'
          }
          analyserNode={
            analyserRef.current
          }
          className="w-full h-14"
        />

        <div className="w-full flex items-center justify-between mt-2 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                voiceState ===
                'LISTENING'
                  ? 'bg-cyber-cyan animate-ping'
                  : voiceState ===
                    'SPEAKING'
                  ? 'bg-amber-400 animate-pulse'
                  : voiceState ===
                    'PROCESSING'
                  ? 'bg-violet-400 animate-pulse'
                  : geminiStatus.configured
                  ? 'bg-emerald-400'
                  : 'bg-slate-600'
              }`}
            />

            {
              stateLabelMap[
                voiceState
              ]
            }
          </span>

          <span className="text-slate-400">
            {geminiStatus.configured
              ? 'LIVE'
              : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* CHAT */}
      <div className="p-3 space-y-2.5 max-h-60 overflow-y-auto font-sans text-xs scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${
              message.sender ===
              'user'
                ? 'items-end'
                : 'items-start'
            }`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-3 py-2 leading-relaxed shadow-sm whitespace-pre-wrap ${
                message.sender ===
                'user'
                  ? 'bg-cyber-cyan text-space-950 font-medium'
                  : 'bg-space-850 text-slate-200 border border-slate-800 font-mono text-[11px]'
              }`}
            >
              {message.text}
            </div>

            <span className="text-[9px] font-mono text-slate-400 mt-0.5 px-1">
              {message.sender ===
              'user'
                ? 'You'
                : 'Sentinel Copilot'}{' '}
              ·{' '}
              {
                message.timestamp
              }
            </span>
          </div>
        ))}

        {transcript && (
          <div className="flex flex-col items-end">
            <div className="max-w-[85%] rounded-xl px-3 py-2 bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/50 italic text-xs">
              "{transcript}"
            </div>
          </div>
        )}

        {voiceError && (
          <div className="rounded-xl border border-rose-500/50 bg-rose-900/30 px-3 py-2 text-[11px] text-rose-100">
            {voiceError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* CONFIRMATION */}
      {pendingConfirmation && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-amber-950/80 border border-amber-500/70 text-amber-200 text-xs shadow-lg">
          <div className="flex items-center gap-2 font-bold font-mono text-amber-400 mb-1.5">
            <ShieldAlert className="w-4 h-4" />

            CONFIRMATION REQUIRED
          </div>

          <p className="text-[11px] mb-2 font-mono">
            <strong className="text-white">
              {pendingConfirmation.description ||
                'Requested SentinelBurn action'}
            </strong>
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                handleConfirmAction(
                  true
                )
              }
              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-space-950 font-bold font-mono text-[11px] rounded transition-colors shadow"
            >
              CONFIRM
            </button>

            <button
              onClick={() =>
                handleConfirmAction(
                  false
                )
              }
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] rounded transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* QUICK COMMANDS */}
      <div className="px-3 py-1.5 bg-space-950/50 border-t border-space-850 flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono text-slate-400">
        <span className="shrink-0 text-slate-400">
          TRY:
        </span>

        <button
          onClick={() =>
            handleUserQuery(
              'Why was DUT-104 flagged?'
            )
          }
          className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-cyber-cyan border border-cyber-cyan/20 transition-colors"
        >
          Why DUT-104 flagged?
        </button>

        <button
          onClick={() =>
            handleUserQuery(
              'Show critical devices'
            )
          }
          className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
        >
          Critical devices
        </button>

        <button
          onClick={() =>
            handleUserQuery(
              'Compare DUT-104 with the cohort'
            )
          }
          className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
        >
          Compare with cohort
        </button>

        <button
          onClick={() =>
            handleUserQuery(
              'Put DUT-104 on hold for failure analysis'
            )
          }
          className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-amber-300 border border-amber-500/30 transition-colors"
        >
          Hold DUT-104
        </button>
      </div>

      {/* INPUT */}
      <div className="p-3 bg-space-950 border-t border-slate-800 flex items-center gap-2">
        <button
          onClick={
            handleListenToggle
          }
          className={`p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center shrink-0 ${
            voiceState ===
              'LISTENING' ||
            voiceState ===
              'PROCESSING' ||
            voiceState ===
              'CONNECTING' ||
            voiceState ===
              'REQUESTING_PERMISSION' ||
            voiceState ===
              'SPEAKING' ||
            voiceState ===
              'RECONNECTING'
              ? 'bg-cyber-cyan text-space-950 shadow-cyan-glow animate-pulse'
              : 'bg-space-850 text-cyber-cyan hover:bg-slate-800 border border-slate-700'
          }`}
          title={
            voiceState ===
            'LISTENING'
              ? 'End live voice session'
              : 'Speak to Gemini Live'
          }
          aria-label={
            voiceState ===
            'LISTENING'
              ? 'End live voice session'
              : 'Speak to Gemini Live'
          }
        >
          <Mic className="w-5 h-5" />
        </button>

        <form
          onSubmit={(event) => {
            event.preventDefault();

            if (
              inputText.trim()
            ) {
              handleUserQuery(
                inputText
              );

              setInputText('');
            }
          }}
          className="flex-1 flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inputText}
            onChange={(event) =>
              setInputText(
                event.target.value
              )
            }
            placeholder={
              voiceState ===
              'LISTENING'
                ? 'Live mic active...'
                : 'Ask or type a voice command...'
            }
            className="w-full bg-space-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyber-cyan font-mono"
          />

          <button
            type="submit"
            disabled={
              !inputText.trim()
            }
            className="p-2 rounded-xl bg-space-850 text-slate-300 hover:text-cyber-cyan hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};