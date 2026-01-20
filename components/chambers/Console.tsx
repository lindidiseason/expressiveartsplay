import React, { useEffect, useRef, useState } from 'react';
import { audioService } from '../../services/audioService';
import { AudioNodeData, ConsoleConfig } from '../../types';
import GuideOverlay from '../UI/GuideOverlay';

const Console: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nodes, setNodes] = useState<AudioNodeData[]>([]);
  const nodesRef = useRef<AudioNodeData[]>([]); 
  const [showConfig, setShowConfig] = useState(false);
  
  const [config, setConfig] = useState<ConsoleConfig>({
      scale: 'pentatonic',
      waveform: 'sine',
      tempo: 1.0
  });

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Save / Load Logic
  const savePreset = () => {
      const data = {
          version: 1,
          timestamp: Date.now(),
          config: config,
          nodes: nodes.map(n => ({ ...n, active: false, life: 0 })) // Reset transient states
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SENSORIUM_PRESET_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const loadPreset = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              if (data.nodes && Array.isArray(data.nodes)) {
                  setNodes(data.nodes);
              }
              if (data.config) {
                  setConfig(data.config);
              }
          } catch (err) {
              console.error("Failed to load preset", err);
              alert("Invalid Preset File");
          }
      };
      reader.readAsText(file);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Unified Handler: Add OR Remove based on hit test
  const handleInteraction = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Normalized coordinates
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    // 1. Check for Hit Test (Deletion)
    const hitThreshold = 30 / rect.width; 
    
    const hitIndex = nodes.findIndex(node => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.sqrt(dx*dx + dy*dy) < hitThreshold;
    });

    if (hitIndex !== -1) {
        // Remove existing node
        const newNodes = [...nodes];
        newNodes.splice(hitIndex, 1);
        setNodes(newNodes);
    } else {
        // 2. Add New Node
        const steps = 15;
        const index = Math.floor((1 - y) * steps);
        
        const root = config.scale === 'phrygian' ? 80 : 110; 
        const freq = audioService.getNoteFrequency(index, config.scale, root);

        const newNode: AudioNodeData = {
            id: Math.random().toString(36).substr(2, 9),
            x,
            y,
            active: false,
            frequency: freq,
            life: 0
        };

        setNodes(prev => [...prev, newNode]);
        audioService.playPing(freq, x, config.waveform);
    }
  };

  const clearNodes = () => setNodes([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let angle1 = 0; 
    let angle2 = Math.PI;

    const render = () => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);
      
      // Grid
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gridSize = w < 768 ? 50 : 100;
      for(let i=0; i<w; i+=gridSize) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
      for(let i=0; i<h; i+=gridSize) { ctx.moveTo(0, i); ctx.lineTo(w, i); }
      ctx.stroke();

      // Pitch Guides
      ctx.save();
      ctx.strokeStyle = '#1a1a1a';
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      for(let i=1; i<10; i++) {
          const y = h - (i * (h/10));
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          ctx.fillText(`PITCH ${i}`, w - 10, y - 5);
      }
      ctx.restore();
      
      // Radar Rings
      ctx.strokeStyle = '#333';
      const maxRings = w < 768 ? 3 : 6;
      for (let i = 1; i <= maxRings; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, i * (w < 768 ? 50 : 80), 0, Math.PI * 2);
        ctx.stroke();
      }

      angle1 += 0.02 * config.tempo;
      angle2 += 0.03 * config.tempo;
      if (angle1 > Math.PI * 2) angle1 -= Math.PI * 2;
      if (angle2 > Math.PI * 2) angle2 -= Math.PI * 2;

      drawScanner(ctx, cx, cy, Math.max(w, h), angle1, 'rgba(255, 165, 0, 0.5)', '#ffaa00');
      drawScanner(ctx, cx, cy, Math.max(w, h), angle2, 'rgba(0, 165, 255, 0.3)', '#00aaff');

      nodesRef.current.forEach(node => {
        const nx = node.x * w;
        const ny = node.y * h;
        
        const dx = nx - cx;
        const dy = ny - cy;
        let nodeAngle = Math.atan2(dy, dx);
        if (nodeAngle < 0) nodeAngle += Math.PI * 2;
        
        let triggered = false;
        const diff1 = Math.abs(angle1 - nodeAngle);
        if (diff1 < 0.05 && !node.active) triggered = true;
        
        const diff2 = Math.abs(angle2 - nodeAngle);
        if (diff2 < 0.05 && !node.active) triggered = true;

        if (Math.abs(angle1 - nodeAngle) > 0.2 && Math.abs(angle2 - nodeAngle) > 0.2) {
            node.active = false;
        }

        if (triggered) {
            audioService.playPing(node.frequency, node.x, config.waveform);
            node.active = true;
            node.life = 1.0; 
        }

        if (node.life > 0) node.life -= 0.05;
        
        // Draw Node
        const glow = node.life * 20;
        ctx.shadowBlur = glow;
        ctx.shadowColor = node.active ? '#fff' : '#ffaa00';
        
        ctx.fillStyle = `rgba(255, ${255 - (1-node.y)*100}, ${255 - node.life*255}, 1)`;
        ctx.beginPath();
        const size = (w < 768 ? 12 : 8) + node.life * 10;
        ctx.arc(nx, ny, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Visual Connector
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + node.life * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      });

      animationId = requestAnimationFrame(render);
    };

    render();
    
    const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        handleInteraction(t.clientX, t.clientY);
    };

    canvas?.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
        cancelAnimationFrame(animationId);
        canvas?.removeEventListener('touchstart', handleTouchStart);
    };
  }, [config, nodes]); 

  const drawScanner = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number, fill: string, stroke: string) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(0, 0, r, 0);
      gradient.addColorStop(0, fill);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0, r, -0.05, 0.05);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(r, 0);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
  }

  return (
    <div className="w-full h-full relative cursor-crosshair overflow-hidden touch-none" onClick={(e) => handleInteraction(e.clientX, e.clientY)}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <input type="file" ref={fileInputRef} onChange={loadPreset} accept=".json" className="hidden" />
      
      <GuideOverlay 
        title="CONSOLE RADAR"
        titleCn="雷达控制台"
        rules={[
            { en: "Tap to place a Node.", cn: "点击空白处放置音符节点。" },
            { en: "Tap existing Node to REMOVE it.", cn: "点击现有节点将其移除。" },
            { en: "Orange/Blue scanners trigger sounds.", cn: "橙色/蓝色扫描线触发声音。" },
            { en: "Distance from center affects timing.", cn: "与中心的距离决定节奏。" }
        ]}
      />

      <div className="absolute top-10 right-16 text-right pointer-events-none">
         <h3 className="text-orange-500/50 text-[9px] md:text-[10px] tracking-[0.3em] font-mono">POLY-RHYTHM</h3>
         <p className="text-white/20 text-[9px] md:text-[10px] mt-1 font-mono">NODES: {nodes.length}</p>
      </div>

      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
         {!showConfig ? (
             <button onClick={(e) => {e.stopPropagation(); setShowConfig(true)}} className="px-4 py-2 bg-black/50 border border-white/20 rounded-full text-[10px] uppercase tracking-widest hover:bg-white/10 backdrop-blur-md">
                 Config / 配置
             </button>
         ) : (
            <div className="bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 flex flex-col gap-4 w-64" onClick={(e) => e.stopPropagation()}>
                
                {/* Scale & Wave */}
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[8px] uppercase tracking-widest text-gray-500">Scale / 音阶</label>
                        <div className="flex flex-col gap-1">
                            {(['pentatonic', 'phrygian'] as const).map(s => (
                                <button key={s} onClick={() => setConfig({...config, scale: s})} 
                                className={`px-2 py-1 text-[9px] border rounded ${config.scale === s ? 'bg-orange-500 text-black border-orange-500' : 'border-white/20 text-white/50'}`}>
                                    {s.substring(0,4).toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[8px] uppercase tracking-widest text-gray-500">Wave / 波形</label>
                        <div className="flex flex-col gap-1">
                            {(['sine', 'triangle', 'square'] as const).map(w => (
                                <button key={w} onClick={() => setConfig({...config, waveform: w})} 
                                className={`px-2 py-1 text-[9px] border rounded ${config.waveform === w ? 'bg-blue-500 text-black border-blue-500' : 'border-white/20 text-white/50'}`}>
                                    {w.substring(0,3).toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Import/Export */}
                <div className="border-t border-white/10 pt-2 flex gap-2">
                    <button onClick={savePreset} className="flex-1 py-1 text-[9px] bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded uppercase">
                        Save Preset
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-1 text-[9px] bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded uppercase">
                        Load Preset
                    </button>
                </div>

                <button onClick={() => clearNodes()} className="w-full py-2 border border-red-500/30 text-red-400 uppercase text-[10px] rounded hover:bg-red-900/20">
                    Clear All / 清空
                </button>
                <button onClick={() => setShowConfig(false)} className="text-[9px] text-gray-500 uppercase mt-1">Close / 关闭</button>
            </div>
         )}
      </div>
    </div>
  );
};

export default Console;