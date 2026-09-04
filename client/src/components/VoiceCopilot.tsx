import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  X, 
  Minus, 
  Send, 
  GripHorizontal, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  HelpCircle,
  Radio,
  ChevronRight
} from 'lucide-react';
import { copilotApi } from '../services/api';
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

export const VoiceCopilot: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeRun } = useRunStore();

  // Window position & drag state
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 560 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initX: 0, initY: 0 });

  // Widget state: closed by default (small floating logo button)
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<MessageLog[]>([
    {
      id: 'msg-welcome',
      sender: 'copilot',
      text: 'SentinelBurn Voice Copilot online. Ask me about flagged devices, SHAP explanations, or issue component dispositions.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [pendingConfirmation, setPendingConfirmation] = useState<any | null>(null);

  // Audio Context & Analyser
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Speech Recognition ref
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of message log
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript]);

  // Adjust default position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 400),
        y: Math.min(prev.y, window.innerHeight - 500)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = 'en-US';

      recog.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);

        if (event.results[0].isFinal) {
          handleUserQuery(currentTranscript);
          setTranscript('');
          stopListening();
        }
      };

      recog.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
        stopListening();
      };

      recog.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recog;
    }
  }, []);

  // Dragging handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initX: position.x,
      initY: position.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;
    const newX = Math.max(10, Math.min(window.innerWidth - 390, dragStartRef.current.initX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 120, dragStartRef.current.initY + dy));
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Microphone toggle
  const startListening = async () => {
    try {
      // Setup Web Audio Analyser
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 64;
        }
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        if (audioContextRef.current && analyserRef.current) {
          const source = audioContextRef.current.createMediaStreamSource(stream);
          source.connect(analyserRef.current);
        }
      }

      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert('Web Speech API is not supported in this browser. You can type commands in the text box below.');
      }
    } catch (err) {
      console.warn('Microphone permission or start error:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Text-To-Speech Output
  const speakText = (text: string) => {
    if (isMuted || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // cancel prior speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick crisp aerospace voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Natural') || v.name.includes('Google UK English Male') || v.name.includes('Samantha')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Process User Query
  const handleUserQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: MessageLog = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const res = await copilotApi.query({
        query: queryText,
        runId: activeRun?.id || 'run-isro-live-001',
        pendingConfirmation: pendingConfirmation || undefined
      });

      const copilotMsg: MessageLog = {
        id: `msg-${Date.now() + 1}`,
        sender: 'copilot',
        text: res.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isConfirmation: res.requiresConfirmation
      };

      setMessages(prev => [...prev, copilotMsg]);

      // Set confirmation state if required
      if (res.requiresConfirmation) {
        setPendingConfirmation(res.confirmationPayload);
      } else {
        setPendingConfirmation(null);
      }

      // Voice Response
      if (res.spokenText) {
        speakText(res.spokenText);
      }

      // Contextual Navigation
      if (res.navigationUrl) {
        navigate(res.navigationUrl);
      }
    } catch (err: any) {
      const errorMsg: MessageLog = {
        id: `msg-${Date.now() + 1}`,
        sender: 'copilot',
        text: 'Telemetry query error: ' + (err.message || 'Check backend service connectivity.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = (confirm: boolean) => {
    if (confirm) {
      handleUserQuery('CONFIRM');
    } else {
      handleUserQuery('CANCEL');
    }
  };

  // Render small floating logo button when closed / minimized
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 group">
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-space-900 via-space-850 to-space-950 border-2 border-cyber-cyan/60 shadow-cyan-glow hover:border-cyber-cyan hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer"
          title="Open SentinelVoice Copilot"
        >
          {/* Subtle outer breathing ring */}
          <span className="absolute inset-0 rounded-full border border-cyber-cyan/30 animate-ping opacity-30 pointer-events-none" />

          {/* Logo icon with glow */}
          <div className="relative flex items-center justify-center pointer-events-none">
            <Radio className="w-6 h-6 text-cyber-cyan group-hover:rotate-12 transition-transform duration-300 animate-pulse" />
            <Sparkles className="w-3 h-3 text-amber-400 absolute -top-1.5 -right-1.5 animate-bounce" />
          </div>

          {/* Active status beacon dot */}
          <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-space-950 shadow-sm" />
        </button>

        {/* Floating tooltip on hover */}
        <div className="absolute right-16 bottom-2.5 px-3 py-1.5 rounded-lg bg-space-900/95 border border-slate-700 text-xs font-mono text-slate-200 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          <span className="text-cyber-cyan font-bold">SentinelVoice</span> Copilot
        </div>
      </div>
    );
  }

  // Render Full Draggable Mission Copilot
  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 w-96 rounded-2xl bg-space-900/95 border border-slate-700/90 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Draggable Header */}
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
              {user?.role?.toUpperCase().replace('_', ' ')} · xtWave Real-time AI
            </div>
          </div>
        </div>

        {/* Window controls */}
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

      {/* Real-Time Audio Visualizer & Waveform */}
      <div className="px-4 pt-3 pb-2 bg-space-950/60 border-b border-slate-800/60 flex flex-col items-center">
        <AudioVisualizer
          isListening={isListening}
          isSpeaking={isSpeaking}
          analyserNode={analyserRef.current}
          className="w-full h-14"
        />

        <div className="w-full flex items-center justify-between mt-2 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-cyber-cyan animate-ping' : isSpeaking ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
            {isListening ? 'LISTENING TO SPEECH...' : isSpeaking ? 'SYNTHESIZING VOCAL RESPONSE...' : isProcessing ? 'ANALYZING TELEMETRY...' : 'STANDBY (CLICK MIC TO SPEAK)'}
          </span>
          <span className="text-slate-400">MIL-STD-883K</span>
        </div>
      </div>

      {/* Transcript & Message History */}
      <div className="p-3 space-y-2.5 max-h-60 overflow-y-auto font-sans text-xs scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-3 py-2 leading-relaxed shadow-sm whitespace-pre-wrap ${
                m.sender === 'user'
                  ? 'bg-cyber-cyan text-space-950 font-medium'
                  : 'bg-space-850 text-slate-200 border border-slate-800 font-mono text-[11px]'
              }`}
            >
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

        <div ref={messagesEndRef} />
      </div>

      {/* Safety Confirmation Banner if required */}
      {pendingConfirmation && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-amber-950/80 border border-amber-500/70 text-amber-200 text-xs shadow-lg">
          <div className="flex items-center gap-2 font-bold font-mono text-amber-400 mb-1.5">
            <ShieldAlert className="w-4 h-4" />
            CONFIRMATION REQUIRED
          </div>
          <p className="text-[11px] mb-2 font-mono">
            Execute <strong className="text-white uppercase">{pendingConfirmation.decision}</strong> on DUT {pendingConfirmation.deviceId.replace('d-', '')}?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleConfirmAction(true)}
              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-space-950 font-bold font-mono text-[11px] rounded transition-colors shadow"
            >
              CONFIRM
            </button>
            <button
              onClick={() => handleConfirmAction(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] rounded transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Quick Prompt Suggestions */}
      <div className="px-3 py-1.5 bg-space-950/50 border-t border-slate-850 flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono text-slate-400">
        <span className="shrink-0 text-slate-400">TRY:</span>
        <button
          onClick={() => handleUserQuery('Why was DUT-104 flagged?')}
          className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-cyber-cyan border border-cyber-cyan/20 transition-colors"
        >
          Why DUT-104 flagged?
        </button>
        <button
          onClick={() => handleUserQuery('Show critical devices')}
          className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
        >
          Critical devices
        </button>
        <button
          onClick={() => handleUserQuery('Compare DUT-104 with the cohort')}
          className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
        >
          Compare with cohort
        </button>
        <button
          onClick={() => handleUserQuery('Put DUT-104 on hold for failure analysis')}
          className="shrink-0 px-2 py-1 rounded bg-space-850 hover:bg-slate-800 text-amber-300 border border-amber-500/30 transition-colors"
        >
          Hold DUT-104
        </button>
      </div>

      {/* Voice Mic Button & Text Input Bar */}
      <div className="p-3 bg-space-950 border-t border-slate-800 flex items-center gap-2">
        <button
          onClick={toggleListening}
          className={`p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center shrink-0 ${
            isListening
              ? 'bg-cyber-cyan text-space-950 shadow-cyan-glow animate-pulse'
              : 'bg-space-850 text-cyber-cyan hover:bg-slate-800 border border-slate-700'
          }`}
          title={isListening ? 'Stop Listening' : 'Speak to Copilot'}
        >
          {isListening ? <Mic className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
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
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isListening ? 'Listening to voice...' : 'Ask or type voice command...'}
            className="w-full bg-space-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyber-cyan font-mono"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-xl bg-space-850 text-slate-300 hover:text-cyber-cyan hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
