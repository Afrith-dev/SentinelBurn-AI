import React, { useState, useEffect, useRef } from 'react';
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

type VoiceState = 'IDLE' | 'REQUESTING_PERMISSION' | 'CONNECTING' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'RECONNECTING' | 'ERROR';

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

const floatTo16BitPCM = (samples: Float32Array) => {
  const buffer = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return new Uint8Array(buffer.buffer);
};

export const VoiceCopilot: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeRun } = useRunStore();

  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 560 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initX: 0, initY: 0 });

  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [voiceError, setVoiceError] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<{ configured: boolean; mode: string; message: string; model: string; liveModel: string }>({
    configured: false,
    mode: 'fallback',
    message: 'Checking Gemini Live configuration…',
    model: '',
    liveModel: ''
  });
  const [messages, setMessages] = useState<MessageLog[]>([
    {
      id: 'msg-welcome',
      sender: 'copilot',
      text: 'SentinelVoice is online. Use the live mic for Gemini Live, or type a query in the chat fallback at any time.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [pendingConfirmation, setPendingConfirmation] = useState<any | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activePlaybackCountRef = useRef(0);
  const captureEnabledRef = useRef(false);
  const nextPlaybackTimeRef = useRef(0);
  const socketRef = useRef<any>(null);
  const streamingCopilotMessageIdRef = useRef<string | null>(null);
  const copilotSessionIdRef = useRef(`copilot-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const appendMessage = (sender: 'user' | 'copilot', text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const appendStreamingCopilotText = (chunk: string) => {
    if (!chunk) return;

    setMessages((prev) => {
      const activeId = streamingCopilotMessageIdRef.current;
      const activeMessage = activeId ? prev.find((message) => message.id === activeId) : undefined;

      if (activeMessage) {
        const needsSeparator = !/\s$/.test(activeMessage.text) && !/^\s/.test(chunk) &&
          /[A-Za-z0-9]$/.test(activeMessage.text) && /^[A-Za-z0-9]/.test(chunk);
        return prev.map((message) => message.id === activeId
          ? { ...message, text: `${message.text}${needsSeparator ? ' ' : ''}${chunk}` }
          : message);
      }

      const id = `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      streamingCopilotMessageIdRef.current = id;
      return [...prev, {
        id,
        sender: 'copilot',
        text: chunk,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }];
    });
  };

  const finishStreamingCopilotMessage = () => {
    streamingCopilotMessageIdRef.current = null;
  };

  const stopPlayback = () => {
    for (const source of playbackSourcesRef.current) {
      try {
        source.stop();
      } catch (_) {}
      source.disconnect();
    }
    playbackSourcesRef.current.clear();
    activePlaybackCountRef.current = 0;
    nextPlaybackTimeRef.current = 0;
    playbackSourceRef.current = null;
  };

  const disconnectMicCapture = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    captureEnabledRef.current = false;
    socketRef.current?.emit('voice:audio-end');
  };

  const ensureAudioContext = async () => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio API is not available in this browser.');

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  const startCapture = async () => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      micStreamRef.current = stream;
      const context = await ensureAudioContext();
      const source = context.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = analyserRef.current;
      if (analyser) {
        source.connect(analyser);
      }

      const processor = context.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      source.connect(processor);

      const gainNode = context.createGain();
      gainNode.gain.value = 0;
      processor.connect(gainNode);
      gainNode.connect(context.destination);

      processor.onaudioprocess = (event) => {
        if (!captureEnabledRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPCM(input);
        if (pcm.length > 0) {
          socketRef.current.emit('voice:audio', Array.from(pcm));
        }
      };
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      setVoiceState('ERROR');
      setVoiceError(err?.message || 'Microphone access denied.');
    }
  };

  const playGeminiAudio = async (base64Audio: string) => {
    if (!base64Audio || isMuted) return;

    try {
      const audioData = Uint8Array.from(atob(base64Audio), (char) => char.charCodeAt(0));
      const audioContext = await ensureAudioContext();
      const arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
      const decoded = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = decoded;
      source.connect(audioContext.destination);
      playbackSourceRef.current = source;
      playbackSourcesRef.current.add(source);
      activePlaybackCountRef.current += 1;
      const startAt = Math.max(audioContext.currentTime, nextPlaybackTimeRef.current);
      nextPlaybackTimeRef.current = startAt + decoded.duration;

      setVoiceState('SPEAKING');
      source.onended = () => {
        playbackSourcesRef.current.delete(source);
        activePlaybackCountRef.current = Math.max(0, activePlaybackCountRef.current - 1);
        if (activePlaybackCountRef.current === 0) {
          playbackSourceRef.current = null;
          setVoiceState('LISTENING');
        }
      };

      source.start(startAt);
    } catch (err) {
      console.warn('Unable to decode Gemini audio payload:', err);
      setVoiceState('LISTENING');
    }
  };

  const startLiveVoiceSession = async () => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
    }

    setVoiceError('');
    setVoiceState('REQUESTING_PERMISSION');

    try {
      await startCapture();
      if (!micStreamRef.current) {
        return;
      }

      setVoiceState('CONNECTING');
      captureEnabledRef.current = true;
      socketRef.current.emit('voice:connect');
    } catch (err: any) {
      setVoiceState('ERROR');
      setVoiceError(err?.message || 'Unable to start the live voice session.');
    }
  };

  const endLiveVoiceSession = () => {
    stopPlayback();
    disconnectMicCapture();
    socketRef.current?.emit('voice:disconnect-session');
    setVoiceState('IDLE');
    setVoiceError('');
  };

  const handleUserQuery = async (queryText: string, pendingActionId?: string) => {
    if (!queryText.trim()) return;

    appendMessage('user', queryText);
    setVoiceState('PROCESSING');
    setTranscript('');

    try {
      const res = await copilotApi.query({
        query: queryText,
        runId: activeRun?.id || 'run-isro-live-001',
        pendingActionId: pendingActionId || pendingConfirmation?.actionId,
        sessionId: copilotSessionIdRef.current
      });

      appendMessage('copilot', res.message);
      if (res.requiresConfirmation) {
        setPendingConfirmation(res.confirmationPayload);
      } else {
        setPendingConfirmation(null);
      }

      if (res.spokenText && !isMuted) {
        const utterance = new SpeechSynthesisUtterance(res.spokenText);
        utterance.rate = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }

      if (res.navigationUrl && !res.requiresConfirmation) {
        navigate(res.navigationUrl);
      }
      if (res.data?.monitoringRequested) {
        socketRef.current?.emit('voice:monitor-start', activeRun?.id || 'run-isro-live-001');
      }
    } catch (err: any) {
      appendMessage('copilot', 'Telemetry query error: ' + (err.message || 'Check backend connectivity.'));
    } finally {
      if (voiceState !== 'SPEAKING') {
        setVoiceState('LISTENING');
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript]);

  useEffect(() => {
    copilotApi.getGeminiStatus()
      .then((status) => setGeminiStatus(status))
      .catch(() => setGeminiStatus({
        configured: false,
        mode: 'fallback',
        message: 'Gemini status unavailable. Fallback telemetry copilot remains active.',
        model: '',
        liveModel: ''
      }));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.min(prev.x, window.innerWidth - 400),
        y: Math.min(prev.y, window.innerHeight - 500)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('voice:connected', ({ model }) => {
      finishStreamingCopilotMessage();
      setGeminiStatus((prev) => ({ ...prev, configured: true, liveModel: model, message: 'Gemini Live session connected.' }));
      setVoiceState('LISTENING');
    });

    socket.on('voice:state', (nextState: VoiceState) => {
      setVoiceState(nextState);
    });

    socket.on('voice:error', ({ message }) => {
      finishStreamingCopilotMessage();
      setVoiceError(message || 'Gemini Live failed.');
      setVoiceState('ERROR');
      appendMessage('copilot', message || 'Gemini Live failed.');
    });

    socket.on('voice:transcript', ({ text, source, interim }) => {
      if (!text) return;
      if (source === 'gemini') {
        appendStreamingCopilotText(text);
      } else if (interim) {
        setTranscript(text);
      } else {
        appendMessage('user', text);
        setTranscript('');
      }
    });

    socket.on('voice:action-preview', (pendingAction) => {
      setPendingConfirmation(pendingAction);
    });

    socket.on('voice:action-result', (result) => {
      if (result?.message) appendMessage('copilot', result.message);
      setPendingConfirmation(null);
      if (result?.navigationUrl) navigate(result.navigationUrl);
    });

    socket.on('voice:monitor-update', ({ message }) => {
      if (message) appendMessage('copilot', message);
    });

    socket.on('voice:response', async ({ text, audioBase64, turnComplete, interrupted }) => {
      if (interrupted) {
        stopPlayback();
      }

      if (text) {
        appendStreamingCopilotText(text);
      }

      if (audioBase64) {
        await playGeminiAudio(audioBase64);
      }

      if (interrupted || turnComplete) {
        finishStreamingCopilotMessage();
        setVoiceState('LISTENING');
      }
    });

    socket.on('voice:disconnected', () => {
      finishStreamingCopilotMessage();
      setVoiceState('RECONNECTING');
      setVoiceError('Gemini connection lost. Reconnecting…');
    });

    return () => {
      socket.off('voice:connected');
      socket.off('voice:state');
      socket.off('voice:error');
      socket.off('voice:transcript');
      socket.off('voice:action-preview');
      socket.off('voice:action-result');
      socket.off('voice:monitor-update');
      socket.off('voice:response');
      socket.off('voice:disconnected');
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      initX: position.x,
      initY: position.y
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = event.clientX - dragStartRef.current.mouseX;
    const dy = event.clientY - dragStartRef.current.mouseY;
    const newX = Math.max(10, Math.min(window.innerWidth - 390, dragStartRef.current.initX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 120, dragStartRef.current.initY + dy));
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch (_) {}
  };

  const handleListenToggle = async () => {
    if (voiceState === 'LISTENING' || voiceState === 'PROCESSING' || voiceState === 'CONNECTING' || voiceState === 'REQUESTING_PERMISSION' || voiceState === 'SPEAKING') {
      endLiveVoiceSession();
      return;
    }

    if (voiceState === 'ERROR') {
      setVoiceError('');
    }

    await startLiveVoiceSession();
  };

  const handleConfirmAction = (confirm: boolean) => {
    const actionId = pendingConfirmation?.actionId;
    if (!actionId) return;
    const confirmationText = confirm ? 'Confirm' : 'Cancel';
    if (socketRef.current?.connected && voiceState !== 'IDLE' && voiceState !== 'ERROR') {
      socketRef.current.emit('voice:text', confirmationText);
      return;
    }
    if (confirm) {
      handleUserQuery('Confirm', actionId);
    } else {
      handleUserQuery('Cancel', actionId);
    }
  };

  const statusText = voiceError || geminiStatus.message || 'Gemini Live Ready';

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 group">
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-space-900 via-space-850 to-space-950 border-2 border-cyber-cyan/60 shadow-cyan-glow hover:border-cyber-cyan hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer"
          title="Open SentinelVoice Copilot"
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

  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 w-96 rounded-2xl bg-space-900/95 border border-slate-700/90 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150"
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="px-4 py-3 bg-gradient-to-r from-space-950 via-space-900 to-space-950 border-b border-slate-800 flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-500" />
          <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
          <div>
            <div className="text-xs font-mono font-extrabold tracking-wider bg-gradient-to-r from-white via-slate-200 to-cyber-cyan bg-clip-text text-transparent">
              SENTINEL<span className="text-cyber-cyan">VOICE</span> COPILOT
            </div>
            <div className="text-[9px] font-mono text-slate-400">
              {user?.role?.toUpperCase().replace('_', ' ')} · {geminiStatus.configured ? 'Gemini Live Ready' : 'Telemetry Fallback Mode'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyber-cyan" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Minimize to Logo"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 bg-space-950/60 border-b border-slate-800/60 flex flex-col items-center">
        <AudioVisualizer
          isListening={voiceState === 'LISTENING'}
          isSpeaking={voiceState === 'SPEAKING'}
          analyserNode={analyserRef.current}
          className="w-full h-14"
        />

        <div className="w-full flex items-center justify-between mt-2 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              voiceState === 'LISTENING' ? 'bg-cyber-cyan animate-ping' :
              voiceState === 'SPEAKING' ? 'bg-amber-400 animate-pulse' :
              voiceState === 'PROCESSING' ? 'bg-violet-400 animate-pulse' :
              geminiStatus.configured ? 'bg-emerald-400' : 'bg-slate-600'
            }`} />
            {stateLabelMap[voiceState]}
          </span>
          <span className="text-slate-400">{geminiStatus.configured ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      <div className="p-3 space-y-2.5 max-h-60 overflow-y-auto font-sans text-xs scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[88%] rounded-xl px-3 py-2 leading-relaxed shadow-sm whitespace-pre-wrap ${m.sender === 'user' ? 'bg-cyber-cyan text-space-950 font-medium' : 'bg-space-850 text-slate-200 border border-slate-800 font-mono text-[11px]'}`}>
              {m.text}
            </div>
            <span className="text-[9px] font-mono text-slate-400 mt-0.5 px-1">
              {m.sender === 'user' ? 'You' : 'Sentinel Copilot'} · {m.timestamp}
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

      {pendingConfirmation && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-amber-950/80 border border-amber-500/70 text-amber-200 text-xs shadow-lg">
          <div className="flex items-center gap-2 font-bold font-mono text-amber-400 mb-1.5">
            <ShieldAlert className="w-4 h-4" />
            CONFIRMATION REQUIRED
          </div>
          <p className="text-[11px] mb-2 font-mono">
            <strong className="text-white">{pendingConfirmation.description || 'Requested SentinelBurn action'}</strong>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => handleConfirmAction(true)} className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-space-950 font-bold font-mono text-[11px] rounded transition-colors shadow">
              CONFIRM
            </button>
            <button onClick={() => handleConfirmAction(false)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] rounded transition-colors">
              CANCEL
            </button>
          </div>
        </div>
      )}

      <div className="px-3 py-1.5 bg-space-950/50 border-t border-slate-850 flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono text-slate-400">
        <span className="shrink-0 text-slate-400">TRY:</span>
        <button onClick={() => handleUserQuery('Why was DUT-104 flagged?')} className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-cyber-cyan border border-cyber-cyan/20 transition-colors">Why DUT-104 flagged?</button>
        <button onClick={() => handleUserQuery('Show critical devices')} className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors">Critical devices</button>
        <button onClick={() => handleUserQuery('Compare DUT-104 with the cohort')} className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors">Compare with cohort</button>
        <button onClick={() => handleUserQuery('Put DUT-104 on hold for failure analysis')} className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-amber-300 border border-amber-500/30 transition-colors">Hold DUT-104</button>
      </div>

      <div className="p-3 bg-space-950 border-t border-slate-800 flex items-center gap-2">
        <button
          onClick={handleListenToggle}
          className={`p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center shrink-0 ${voiceState === 'LISTENING' || voiceState === 'PROCESSING' || voiceState === 'CONNECTING' || voiceState === 'REQUESTING_PERMISSION' || voiceState === 'SPEAKING' ? 'bg-cyber-cyan text-space-950 shadow-cyan-glow animate-pulse' : 'bg-space-850 text-cyber-cyan hover:bg-slate-800 border border-slate-700'}`}
          title={voiceState === 'LISTENING' ? 'End live voice session' : 'Speak to Gemini Live'}
        >
          <Mic className="w-5 h-5" />
        </button>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (inputText.trim()) {
              handleUserQuery(inputText);
              setInputText('');
            }
          }}
          className="flex-1 flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder={voiceState === 'LISTENING' ? 'Live mic active...' : 'Ask or type a voice command...'}
            className="w-full bg-space-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyber-cyan font-mono"
          />
          <button type="submit" disabled={!inputText.trim()} className="p-2 rounded-xl bg-space-850 text-slate-300 hover:text-cyber-cyan hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
