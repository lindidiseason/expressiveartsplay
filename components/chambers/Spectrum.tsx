import React, { useEffect, useRef, useState } from 'react';
import { audioService } from '../../services/audioService';
import GuideOverlay from '../UI/GuideOverlay';

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  hueOffset: number;
}

const Spectrum: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointersRef = useRef<{x: number, y: number, id: number}[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // New Controls
  const [controls, setControls] = useState({ 
      damping: 0.95, 
      force: 1.0,
      videoOpacity: 0.6, // Increased default opacity for visibility
      physicsMode: 'attract' as 'attract' | 'repel'
  });

  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const initCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: 640, height: 480 } 
            });
            const video = videoRef.current;
            if(video) {
                if (video.srcObject !== stream) {
                    video.srcObject = stream;
                    video.play().catch(e => {
                        if (e.name !== 'AbortError') console.log("Video play suppressed");
                    });
                }
            }
        } catch(e) { console.log("Camera optional or denied"); }
    };
    initCamera();
    
    return () => {
        const video = videoRef.current;
        if (video && video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
        }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let isMounted = true;
    let animationId: number;
    const dataArray = new Uint8Array(1024);
    const particles: Particle[] = [];
    
    let hands: any = null;
    let camera: any = null;

    const onResults = (results: any) => {
        if (!canvasRef.current) return;
        const newPointers: {x: number, y: number, id: number}[] = [];

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            results.multiHandLandmarks.forEach((landmarks: any, i: number) => {
                const lm = landmarks[8]; 
                const x = (1 - lm.x) * canvas.width; 
                const y = lm.y * canvas.height;
                newPointers.push({ x, y, id: i });
            });
        }
        pointersRef.current = newPointers;
    };

    const initMediaPipe = () => {
        if ((window as any).Hands) {
            hands = new (window as any).Hands({locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 0,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            hands.onResults(onResults);
    
            const video = videoRef.current;
            if (video && (window as any).Camera) {
                camera = new (window as any).Camera(video, {
                    onFrame: async () => {
                        if (!isMounted || !hands) return;
                        if (video) await hands.send({image: video});
                    },
                    width: 640, height: 480
                });
                camera.start();
            }
        }
    };
    
    const initParticles = (w: number, h: number) => {
        particles.length = 0;
        const isMobile = w < 768;
        const cols = isMobile ? 50 : 100; 
        const rows = isMobile ? 30 : 60; 
        const spacingX = w / cols;
        const spacingY = h / rows;

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                particles.push({
                    x: i * spacingX + spacingX/2,
                    y: j * spacingY + spacingY/2,
                    baseX: i * spacingX + spacingX/2,
                    baseY: j * spacingY + spacingY/2,
                    vx: 0,
                    vy: 0,
                    size: Math.random() * 1.5 + 0.5,
                    hueOffset: Math.random() * 60 - 30 
                });
            }
        }
    };

    initParticles(canvas.width, canvas.height);
    initMediaPipe();

    const render = () => {
      const cvs = canvasRef.current;
      const vid = videoRef.current;
      if (!cvs || !ctx) return;

      if (cvs.width !== window.innerWidth || cvs.height !== window.innerHeight) {
          cvs.width = window.innerWidth;
          cvs.height = window.innerHeight;
          initParticles(cvs.width, cvs.height);
      }
      const w = cvs.width;
      const h = cvs.height;

      // 1. Draw Fade Layer (Trails) - THIS MUST BE FIRST
      // This creates the trails for particles
      ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; 
      ctx.fillRect(0, 0, w, h);

      // 2. Draw Video Background - THIS MUST BE SECOND (To sit on top of the black fade)
      if (vid && vid.readyState === 4) {
          ctx.save();
          ctx.globalAlpha = controls.videoOpacity; 
          const vidW = vid.videoWidth || 640;
          const vidH = vid.videoHeight || 480;
          const scale = Math.max(w/vidW, h/vidH);
          const x = (w - vidW * scale) / 2;
          const y = (h - vidH * scale) / 2;
          
          // Slight effect to make it look "integrated" but visible
          ctx.filter = `grayscale(100%) contrast(120%) brightness(1.1)`;
          
          ctx.translate(w, 0); 
          ctx.scale(-1, 1);
          ctx.drawImage(vid, x * -1 - (vidW*scale), y, vidW * scale, vidH * scale);
          ctx.restore();
          ctx.globalAlpha = 1.0;
      }

      // 3. Audio & Physics Logic
      audioService.getAnalyserData(dataArray, 'freq');
      
      let bassEnergy = 0;
      for(let i=0; i<20; i++) bassEnergy += dataArray[i];
      bassEnergy /= 20; 

      if (pointersRef.current.length > 0) {
          let avgY = 0;
          pointersRef.current.forEach(p => avgY += p.y);
          avgY /= pointersRef.current.length;
          const normY = avgY / h; 
          audioService.setExpressiveFilter(1 - Math.max(0, Math.min(1, normY)));
      } else {
          audioService.setExpressiveFilter(0.8); 
      }

      particles.forEach((p, index) => {
        const freqIndex = Math.floor((index / particles.length) * dataArray.length * 0.4);
        const freq = dataArray[freqIndex] || 0;
        const displacement = (freq / 255) * (w < 768 ? 10 : 30);
        
        // Physics
        if (pointersRef.current.length > 0) {
            let closestDistSq = Infinity;
            let closestPointer = null;

            pointersRef.current.forEach(ptr => {
                let dx = p.x - ptr.x;
                let dy = p.y - ptr.y;
                let dSq = dx*dx + dy*dy;
                if (dSq < closestDistSq) {
                    closestDistSq = dSq;
                    closestPointer = ptr;
                }
            });

            const radius = w < 768 ? 200 : 300; 
            
            if (closestPointer && closestDistSq < radius * radius) {
                const dist = Math.sqrt(closestDistSq);
                const force = (radius - dist) / radius;
                const dx = p.x - closestPointer.x;
                const dy = p.y - closestPointer.y;
                const angle = Math.atan2(dy, dx);
                
                const dirMultiplier = controls.physicsMode === 'attract' ? -1 : 1;
                const dir = 20 * controls.force * dirMultiplier; 
                
                p.vx += Math.cos(angle) * force * dir * 0.5;
                p.vy += Math.sin(angle) * force * dir * 0.5;
            }
        }

        const spring = 0.08;
        const targetY = p.baseY - displacement; 
        p.vx += (p.baseX - p.x) * spring;
        p.vy += (targetY - p.y) * spring;
        p.vx *= controls.damping;
        p.vy *= controls.damping;
        p.x += p.vx;
        p.y += p.vy;

        const baseHue = (Date.now() * 0.02) % 360;
        const hue = baseHue + p.hueOffset + (bassEnergy * 0.5);
        const light = 60 + (freq/255)*40; // Slightly brighter particles to pop against video
        
        ctx.fillStyle = `hsl(${hue}, 80%, ${light}%)`;
        ctx.beginPath();
        ctx.rect(p.x, p.y, p.size, p.size);
        ctx.fill();
      });

      // Draw Reticles
      pointersRef.current.forEach(ptr => {
          ctx.beginPath();
          ctx.strokeStyle = controls.physicsMode === 'attract' ? '#ff0044' : '#00ffcc'; // Red for attract, Cyan for repel
          ctx.lineWidth = 2;
          ctx.arc(ptr.x, ptr.y, 20, 0, Math.PI*2);
          ctx.stroke();
          
          ctx.beginPath();
          if(controls.physicsMode === 'attract') {
              ctx.moveTo(ptr.x - 5, ptr.y); ctx.lineTo(ptr.x + 5, ptr.y);
              ctx.moveTo(ptr.x, ptr.y - 5); ctx.lineTo(ptr.x, ptr.y + 5);
          } else {
              ctx.arc(ptr.x, ptr.y, 5, 0, Math.PI*2);
          }
          ctx.stroke();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
        isMounted = false;
        cancelAnimationFrame(animationId);
        if(camera) {
            try { camera.stop(); } catch(e) {}
        }
        if(hands) {
            try { hands.close(); } catch(e) {}
        }
    };
  }, [controls]);

  return (
    <div className="w-full h-full relative bg-black">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      
      <GuideOverlay 
        title="PRISM FIELD"
        titleCn="棱镜力场"
        rules={[
            { en: "Hand position disrupts particles.", cn: "手势位置干扰粒子场。" },
            { en: "Toggle between Attract & Repel.", cn: "切换“吸引”或“排斥”模式。" },
            { en: "Adjust video background visibility.", cn: "调节背景摄像头清晰度。" },
            { en: "Hand Height controls Audio Filter.", cn: "手势高度控制音频滤波器。" }
        ]}
      />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mix-blend-screen opacity-50">
         <h2 className="text-[10vw] font-bold text-white/5 font-['Syncopate'] leading-none animate-pulse">PRISM</h2>
      </div>

       {/* Controls */}
       <div className="absolute bottom-24 right-4 flex flex-col items-end z-10">
          {!showControls ? (
              <button onClick={() => setShowControls(true)} className="px-4 py-2 bg-black/50 border border-white/20 rounded-full text-[10px] uppercase tracking-widest hover:bg-white/10 backdrop-blur-md">
                  Controls / 控制
              </button>
          ) : (
             <div className="flex flex-col gap-4 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 w-56">
                
                <div className="space-y-1">
                     <label className="text-[8px] uppercase tracking-widest text-gray-400 block">Physics Mode / 物理模式</label>
                     <div className="flex gap-2">
                         <button 
                            onClick={() => setControls({...controls, physicsMode: 'attract'})}
                            className={`flex-1 py-1 text-[9px] border rounded uppercase ${controls.physicsMode === 'attract' ? 'bg-red-500/80 text-white border-red-500' : 'text-gray-400 border-gray-600'}`}>
                            Attract 吸
                         </button>
                         <button 
                            onClick={() => setControls({...controls, physicsMode: 'repel'})}
                            className={`flex-1 py-1 text-[9px] border rounded uppercase ${controls.physicsMode === 'repel' ? 'bg-cyan-500/80 text-black border-cyan-500' : 'text-gray-400 border-gray-600'}`}>
                            Repel 斥
                         </button>
                     </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-widest text-gray-400 flex justify-between">
                        <span>Background / 背景</span>
                        <span>{Math.round(controls.videoOpacity * 100)}%</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.05" value={controls.videoOpacity} 
                        onChange={(e)=>setControls({...controls, videoOpacity: parseFloat(e.target.value)})}
                        className="w-full h-1 bg-white/20 rounded appearance-none" />
                </div>
                
                <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-widest text-gray-400 flex justify-between">
                         <span>Force / 力度</span>
                         <span>{(controls.force).toFixed(1)}x</span>
                    </label>
                    <input type="range" min="0.1" max="3.0" step="0.1" value={controls.force} 
                        onChange={(e)=>setControls({...controls, force: parseFloat(e.target.value)})}
                        className="w-full h-1 bg-white/20 rounded appearance-none" />
                </div>

                <button onClick={() => setShowControls(false)} className="text-[9px] text-gray-500 uppercase mt-2">Close / 关闭</button>
             </div>
          )}
      </div>
    </div>
  );
};

export default Spectrum;