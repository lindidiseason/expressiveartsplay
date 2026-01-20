import React, { useEffect, useRef, useState } from 'react';
import { KaleidoscopeConfig } from '../../types';

const Source: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [config, setConfig] = useState<KaleidoscopeConfig>({
    slices: 12,
    zoom: 1.5,
    rotationSpeed: 0.2
  });

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
        if(video.srcObject !== stream) {
            video.srcObject = stream;
            video.play().catch(e => {
                if(e.name !== 'AbortError') console.error("Source Video play error", e);
            });
        }
    }
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationId: number;
    let rotation = 0;

    const render = () => {
      const cvs = canvasRef.current;
      const vid = videoRef.current;
      if (!cvs || !vid) return;

      if (cvs.width !== window.innerWidth || cvs.height !== window.innerHeight) {
        cvs.width = window.innerWidth;
        cvs.height = window.innerHeight;
      }

      const w = cvs.width;
      const h = cvs.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.sqrt(cx * cx + cy * cy); 

      rotation += (config.rotationSpeed * 0.01);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      if (stream && vid.videoWidth > 0) {
        const sliceAngle = (Math.PI * 2) / config.slices;
        ctx.save();
        ctx.translate(cx, cy);
        
        for (let i = 0; i < config.slices; i++) {
          ctx.save();
          ctx.rotate(i * sliceAngle + rotation);
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, radius, -sliceAngle/2 - 0.01, sliceAngle/2 + 0.01);
          ctx.closePath();
          ctx.clip();

          if (i % 2 === 0) ctx.scale(1, -1);

          const vidW = vid.videoWidth;
          const vidH = vid.videoHeight;
          const scale = (radius / Math.min(vidW, vidH)) * config.zoom;
          
          ctx.scale(scale, scale);
          ctx.rotate(Math.PI / 2); 
          ctx.drawImage(vid, -vidW/2, -vidH/2);

          ctx.restore();
        }
        ctx.restore();
      } else {
        // Fallback
        ctx.strokeStyle = `hsl(${Math.sin(rotation) * 360}, 50%, 50%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i=0; i<config.slices; i++) {
            const angle = (Math.PI * 2 * i) / config.slices + rotation;
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle)* radius, cy + Math.sin(angle)* radius);
        }
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("WAITING FOR SOURCE...", cx, cy + 50);
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [stream, config]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Controls: Stack on mobile, panel on desktop */}
      <div className="absolute bottom-24 md:bottom-20 left-1/2 -translate-x-1/2 z-10 w-[90%] md:w-64 bg-black/50 backdrop-blur p-4 rounded-xl border border-white/10 flex flex-col gap-3">
        <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-white/60 tracking-widest uppercase">
                <span>Segments</span>
                <span>{config.slices}</span>
            </div>
            <input 
                type="range" min="4" max="32" step="2"
                value={config.slices}
                onChange={(e) => setConfig({...config, slices: parseInt(e.target.value)})}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer thumb-white"
            />
        </div>
        <div className="flex gap-4">
             <div className="space-y-1 flex-1">
                <div className="flex justify-between text-[9px] text-white/60 tracking-widest uppercase">
                    <span>Zoom</span>
                </div>
                <input 
                    type="range" min="0.5" max="3" step="0.1"
                    value={config.zoom}
                    onChange={(e) => setConfig({...config, zoom: parseFloat(e.target.value)})}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
            </div>
            <div className="space-y-1 flex-1">
                <div className="flex justify-between text-[9px] text-white/60 tracking-widest uppercase">
                    <span>Speed</span>
                </div>
                <input 
                    type="range" min="-1" max="1" step="0.1"
                    value={config.rotationSpeed}
                    onChange={(e) => setConfig({...config, rotationSpeed: parseFloat(e.target.value)})}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default Source;