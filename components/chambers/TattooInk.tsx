import React, { useEffect, useRef, useState } from 'react';
import { audioService } from '../../services/audioService';
import { InkParticle } from '../../types';
import GuideOverlay from '../UI/GuideOverlay';

// Pentatonic Scale Intervals relative to root
const SCALE_INTERVALS = [1, 1.125, 1.25, 1.5, 1.66, 2, 2.25, 2.5, 3, 3.33]; 

const TattooInk: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Controls
  const [intensity, setIntensity] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showControls, setShowControls] = useState(false);
  
  const particlesRef = useRef<InkParticle[]>([]);

  const clearCanvas = () => {
      particlesRef.current = [];
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
        if(video.srcObject !== stream) {
            video.srcObject = stream;
            video.play().catch(e => {
                if(e.name !== 'AbortError') console.error("Ink Video play error", e);
            });
        }
    }
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); 
    if (!ctx) return;

    let isMounted = true;
    let animationId: number;
    let hands: any = null;
    let camera: any = null;
    
    // Tracking points with Memory of last note to detect crossing
    // We store 'lastNoteIndex' to check for changes
    const pointers = new Map<number, {x: number, y: number, vx: number, vy: number, lastNoteIndex: number}>();

    const onResults = (results: any) => {
        if (!canvasRef.current) return;
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const width = canvasRef.current.width;
            const height = canvasRef.current.height;
            const noteHeight = height / SCALE_INTERVALS.length;

            results.multiHandLandmarks.forEach((landmarks: any, handIndex: number) => {
                const idx = 8; // Index finger
                const lm = landmarks[idx];
                const x = (1 - lm.x) * width;
                const y = lm.y * height;
                
                const id = handIndex; 
                const prev = pointers.get(id);
                const vx = prev ? x - prev.x : 0;
                const vy = prev ? y - prev.y : 0;

                // Calculate current note index
                const invertedY = height - y;
                const currentNoteIndex = Math.min(SCALE_INTERVALS.length - 1, Math.max(0, Math.floor(invertedY / noteHeight)));

                // Keep lastNoteIndex from previous frame, or init with current
                const lastNoteIndex = prev ? prev.lastNoteIndex : currentNoteIndex;

                pointers.set(id, {x, y, vx, vy, lastNoteIndex});
            });
        } else {
            if(Math.random() > 0.9) pointers.clear();
        }
    };

    const initMediaPipe = () => {
        if (!isMounted) return;
        if ((window as any).Hands) {
            hands = new (window as any).Hands({locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
            hands.setOptions({ 
                maxNumHands: 2, 
                minDetectionConfidence: 0.5, 
                minTrackingConfidence: 0.5,
                modelComplexity: 0 
            });
            
            hands.onResults(onResults);

            const video = videoRef.current;
            if (video && (window as any).Camera) {
                camera = new (window as any).Camera(video, {
                    onFrame: async () => { 
                        if (!isMounted || !hands) return;
                        if (hands && video) await hands.send({image: video}); 
                    },
                    width: 640, height: 480
                });
                camera.start();
            }
        }
    };

    // Wait for MediaPipe to load
    let mpInterval: any;
    if ((window as any).Hands) {
        initMediaPipe();
    } else {
        mpInterval = setInterval(() => {
            if ((window as any).Hands) {
                clearInterval(mpInterval);
                initMediaPipe();
            }
        }, 500);
    }

    const render = () => {
        const cvs = canvasRef.current;
        const vid = videoRef.current;
        if (!cvs || !ctx) return;

        if (cvs.width !== window.innerWidth || cvs.height !== window.innerHeight) {
            cvs.width = window.innerWidth;
            cvs.height = window.innerHeight;
        }
        const w = cvs.width;
        const h = cvs.height;

        // 1. Fade
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; 
        ctx.fillRect(0,0,w,h);
        
        // 2. Video Background
        if (vid && vid.videoWidth > 0) {
            ctx.save();
            ctx.globalAlpha = 0.1; 
            ctx.translate(w, 0); ctx.scale(-1, 1);
            ctx.drawImage(vid, 0, 0, w, h);
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

        // 3. Musical Grid Lines
        const noteHeight = h / SCALE_INTERVALS.length;
        
        ctx.lineWidth = 1;
        
        SCALE_INTERVALS.forEach((_, i) => {
            const y = h - (i * noteHeight) - (noteHeight/2); 
            
            // Check if active (being touched)
            let isActive = false;
            for (const p of pointers.values()) {
                const pNoteIdx = Math.floor((h - p.y) / noteHeight);
                if (pNoteIdx === i) { isActive = true; break; }
            }

            ctx.strokeStyle = isActive ? 'rgba(255, 0, 100, 0.5)' : 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            if (isActive) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff0066';
                ctx.fillStyle = '#ff0066';
                ctx.font = '10px monospace';
                ctx.fillText(`NOTE ${i+1}`, 20, y - 5);
                ctx.shadowBlur = 0;
            }
        });


        // 4. Logic & Spawning
        const spawnRate = intensity === 'light' ? 1 : intensity === 'medium' ? 3 : 6;
        
        pointers.forEach((p, id) => {
            const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
            
            const invertedY = h - p.y;
            const currentNoteIndex = Math.min(SCALE_INTERVALS.length - 1, Math.max(0, Math.floor(invertedY / noteHeight)));
            
            // --- HARP LOGIC (CROSSING DETECTION) ---
            if (p.lastNoteIndex !== currentNoteIndex) {
                // LINE CROSSED! TRIGGER SOUND GUARANTEED
                if (soundEnabled) {
                     const rootFreq = 130.81; 
                     const freq = rootFreq * SCALE_INTERVALS[currentNoteIndex];
                     audioService.playPing(freq, p.x/w, 'sine');
                }
                
                // Update the state so we don't trigger again until next change
                p.lastNoteIndex = currentNoteIndex;
            }

            // Color Logic
            const hue = (currentNoteIndex / SCALE_INTERVALS.length) * 280;

            // Draw Brush
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI*2);
            ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
            ctx.fill();

            // Spawn Particles based on movement
            if (speed > 2) {
                for(let i=0; i<spawnRate; i++) {
                    particlesRef.current.push({
                        x: p.x + (Math.random()-0.5)*10,
                        y: p.y + (Math.random()-0.5)*10,
                        vx: p.vx * 0.05 + (Math.random()-0.5),
                        vy: p.vy * 0.05 + (Math.random()-0.5),
                        life: 1.0,
                        history: [],
                        hue: hue + (Math.random() * 20 - 10),
                        size: Math.random() * 3 + (speed * 0.1)
                    });
                }
            }
        });

        // 5. Update & Draw Particles
        ctx.lineCap = 'round';
        
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            
            p.history.push({x: p.x, y: p.y});
            if (p.history.length > 8) p.history.shift();

            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.01; 

            if (p.life <= 0) {
                particlesRef.current.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            if (p.history.length > 0) {
                ctx.moveTo(p.history[0].x, p.history[0].y);
                for(const point of p.history) ctx.lineTo(point.x, point.y);
            }
            ctx.lineTo(p.x, p.y);
            
            ctx.strokeStyle = `hsla(${p.hue}, 70%, 60%, ${p.life})`;
            ctx.lineWidth = p.size * p.life;
            ctx.stroke();
        }

        if (particlesRef.current.length > 1500) {
            particlesRef.current = particlesRef.current.slice(particlesRef.current.length - 1500);
        }

        animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    // Touch Handling (Fallback for when no camera)
    const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        Array.from(e.touches).forEach((t, i) => {
             const idx = 100 + i;
             // Calculate note index for touch
             const noteH = canvasRef.current ? canvasRef.current.height / SCALE_INTERVALS.length : 100;
             const curIdx = Math.floor((canvasRef.current!.height - t.clientY) / noteH);
             
             // Check if we have this pointer
             if (!pointers.has(idx)) {
                 pointers.set(idx, { x: t.clientX, y: t.clientY, vx: 0, vy: 0, lastNoteIndex: curIdx });
             } else {
                 const prev = pointers.get(idx)!;
                 // Update with existing logic will happen in render, but we need to push data
                 pointers.set(idx, { x: t.clientX, y: t.clientY, vx: 0, vy: 0, lastNoteIndex: prev.lastNoteIndex });
                 // Note: Actual crossing logic runs in Render loop
             }
        });
    };
    const handleTouchEnd = (e: TouchEvent) => {
         Array.from(e.changedTouches).forEach((t, i) => pointers.delete(100+i));
    };

    if (canvas) {
        canvas.addEventListener('touchstart', handleTouchMove, {passive: false});
        canvas.addEventListener('touchmove', handleTouchMove, {passive: false});
        canvas.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
        isMounted = false;
        clearInterval(mpInterval);
        cancelAnimationFrame(animationId);
        const cvs = canvasRef.current;
        if (cvs) {
            cvs.removeEventListener('touchstart', handleTouchMove);
            cvs.removeEventListener('touchmove', handleTouchMove);
            cvs.removeEventListener('touchend', handleTouchEnd);
        }
        if(camera) {
            try { camera.stop(); } catch(e) {}
        }
        if(hands) {
            try { hands.close(); } catch(e) {}
        }
    };
  }, [intensity, soundEnabled]);

  return (
    <div className="w-full h-full relative bg-black">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      
      <GuideOverlay 
        title="INK DYNAMICS"
        titleCn="动态水墨"
        rules={[
            { en: "Harp Mode: Cross lines to trigger sound.", cn: "竖琴模式：跨越横线触发声音。" },
            { en: "High Position = High Pitch.", cn: "高处为高音。" },
            { en: "Every line is a distinct note.", cn: "每一根线都是一个独立的音符。" },
            { en: "Speed controls ink thickness.", cn: "速度决定墨迹粗细。" }
        ]}
      />

      <div className="absolute top-10 right-16 text-right pointer-events-none">
         <h3 className="text-pink-500/80 text-[10px] tracking-[0.3em] font-mono">FLOW STATE</h3>
      </div>

      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          {!showControls ? (
              <button onClick={() => setShowControls(true)} className="px-4 py-2 bg-black/50 border border-white/20 rounded-full text-[10px] uppercase tracking-widest hover:bg-white/10 backdrop-blur-md">
                  Settings / 设置
              </button>
          ) : (
            <div className="flex flex-col gap-3 bg-black/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 min-w-[200px]">
                <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-widest text-gray-400 block text-center">Ink Flow / 墨量</label>
                    <div className="flex gap-2 justify-center">
                        {(['light', 'medium', 'heavy'] as const).map(mode => (
                            <button key={mode} onClick={() => setIntensity(mode)}
                                className={`px-2 py-1 text-[9px] border rounded uppercase ${intensity === mode ? 'bg-pink-500 text-black border-pink-500' : 'text-pink-500/50 border-pink-500/30'}`}>
                                {mode === 'light' ? 'Low' : mode === 'medium' ? 'Med' : 'High'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-white/10">
                     <label className="text-[8px] uppercase tracking-widest text-gray-400 block text-center">System / 系统</label>
                     <div className="flex gap-2 justify-center">
                        <button onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`flex-1 px-2 py-1 text-[9px] border rounded uppercase ${soundEnabled ? 'bg-blue-500/20 text-blue-400 border-blue-400' : 'text-gray-500 border-gray-600'}`}>
                            {soundEnabled ? 'ON' : 'OFF'}
                        </button>
                        <button onClick={clearCanvas} className="flex-1 px-2 py-1 text-[9px] border border-red-500/50 text-red-400 rounded uppercase hover:bg-red-500/20">
                            Clear
                        </button>
                    </div>
                </div>
                <button onClick={() => setShowControls(false)} className="mt-2 text-[9px] text-gray-500 uppercase w-full py-1">Close / 关闭</button>
            </div>
          )}
      </div>
    </div>
  );
};

export default TattooInk;