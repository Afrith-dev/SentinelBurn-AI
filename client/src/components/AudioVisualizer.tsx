import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  analyserNode?: AnalyserNode | null;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isListening,
  isSpeaking,
  analyserNode,
  className = 'w-full h-16'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (isListening || isSpeaking) {
        if (analyserNode && isListening) {
          analyserNode.getByteFrequencyData(dataArray);
        }

        const centerY = height / 2;
        const bars = 36;
        const barWidth = width / bars;

        for (let i = 0; i < bars; i++) {
          const normIndex = i / bars;
          // Calculate dynamic height based on audio analyser or synthetic wave
          let intensity = 0.2;
          if (analyserNode && isListening) {
            const dataIndex = Math.floor(normIndex * bufferLength);
            intensity = Math.max(0.15, (dataArray[dataIndex] || 0) / 255.0);
          } else {
            // Smooth undulating harmonic sine waves
            intensity = 0.25 + 0.35 * Math.sin(phase + i * 0.35) * Math.cos(phase * 0.7 + i * 0.2);
          }

          const barHeight = Math.max(4, intensity * (height - 12));
          const x = i * barWidth + barWidth * 0.15;
          const y = centerY - barHeight / 2;

          // Gradient color: Cyan for listening, Amber/Purple for speaking
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          if (isListening) {
            grad.addColorStop(0, '#00f0ff');
            grad.addColorStop(0.5, '#3b82f6');
            grad.addColorStop(1, '#00f0ff');
          } else {
            grad.addColorStop(0, '#f59e0b');
            grad.addColorStop(0.5, '#ec4899');
            grad.addColorStop(1, '#8b5cf6');
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth * 0.7, barHeight, 3);
          ctx.fill();

          // Subtle glow
          ctx.shadowColor = isListening ? 'rgba(0, 240, 255, 0.4)' : 'rgba(245, 158, 11, 0.4)';
          ctx.shadowBlur = 6;
        }

        phase += 0.08;
      } else {
        // Idle baseline state: subtle low-amplitude resting line
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isSpeaking, analyserNode]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={64}
      className={`rounded-lg bg-space-950/80 border border-slate-800/80 ${className}`}
    />
  );
};
