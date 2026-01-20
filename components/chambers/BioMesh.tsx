import React, { useEffect, useRef, useState } from 'react';
import GuideOverlay from '../UI/GuideOverlay';

const BioMesh: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [density, setDensity] = useState<'low' | 'med' | 'high'>('med');
  const [colorMode, setColorMode] = useState<'matrix' | 'cyan' | 'white' | 'rgb'>('matrix');
  const [showControls, setShowControls] = useState(false);

  // Snapshot Function
  const takeSnapshot = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Create a temporary link
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `SENSORIUM_BIOMESH_${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
        if (video.srcObject !== stream) {
            video.srcObject = stream;
            video.play().catch(e => {
                if(e.name !== 'AbortError') console.error("BioMesh Video play error", e);
            });
        }
    }
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animationId: number;
    const chars = " .:-=+*#%@"; 
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

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

      // Background varies slightly by mode
      ctx.fillStyle = colorMode === 'white' ? '#111' : '#000';
      ctx.fillRect(0, 0, w, h);

      if (!stream || !vid.videoWidth) {
        ctx.fillStyle = '#0f0';
        ctx.font = '14px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText('NO SIGNAL_ [ENABLE CAMERA]', w/2, h/2);
        animationId = requestAnimationFrame(render);
        return;
      }

      // Density Logic
      let baseSize = w < 768 ? 10 : 14; 
      if (density === 'low') baseSize *= 1.5; 
      if (density === 'high') baseSize *= 0.6;
      
      const fontSize = Math.max(4, Math.floor(baseSize));
      const cols = Math.ceil(w / fontSize);
      const rows = Math.ceil(h / fontSize);
      
      if (tempCanvas.width !== cols || tempCanvas.height !== rows) {
          tempCanvas.width = cols;
          tempCanvas.height = rows;
      }

      if (tempCtx) {
          tempCtx.save();
          tempCtx.translate(cols, 0);
          tempCtx.scale(-1, 1);
          tempCtx.drawImage(vid, 0, 0, cols, rows);
          tempCtx.restore();

          const imageData = tempCtx.getImageData(0, 0, cols, rows).data;

          ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          for (let y = 0; y < rows; y++) {
              for (let x = 0; x < cols; x++) {
                  const idx = (y * cols + x) * 4;
                  const r = imageData[idx];
                  const g = imageData[idx + 1];
                  const b = imageData[idx + 2];
                  const brightness = (r + g + b) / 3;

                  // Silhouette Threshold
                  if (brightness > 20) {
                      const charIndex = Math.floor((brightness / 255) * (chars.length - 1));
                      const char = chars[charIndex];
                      
                      // Color Logic
                      if (colorMode === 'rgb') {
                          ctx.fillStyle = `rgb(${r},${g},${b})`;
                      } else {
                          const alpha = brightness / 255;
                          if (colorMode === 'matrix') ctx.fillStyle = `rgba(0, 255, 100, ${alpha})`;
                          else if (colorMode === 'cyan') ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
                          else if (colorMode === 'white') ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                      }
                      
                      ctx.fillText(char, x * fontSize + fontSize/2, y * fontSize + fontSize/2);
                  }
              }
          }
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [stream, density, colorMode]);

  return (
    <div className="w-full h-full relative bg-black overflow-hidden">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      <GuideOverlay 
        title="DIGITAL BIOMESH"
        titleCn="生物网格"
        rules={[
            { en: "Visualizes raw camera data as ASCII.", cn: "将原始摄像头数据转化为 ASCII 码。" },
            { en: "RGB Mode enables True Color.", cn: "RGB 模式开启真彩显示。" },
            { en: "Adjust Density for detail level.", cn: "调整密度以改变细节精细度。" },
            { en: "Save snapshots of your digital self.", cn: "保存你数字化形象的快照。" }
        ]}
      />

      <div className="absolute top-10 right-16 text-right pointer-events-none">
         <h3 className="text-green-500/80 text-[10px] tracking-[0.3em] font-mono">DIGITIZATION</h3>
      </div>

      {/* Controls */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          {!showControls ? (
              <button onClick={() => setShowControls(true)} className="px-4 py-2 bg-black/50 border border-white/20 rounded-full text-[10px] uppercase tracking-widest hover:bg-white/10 backdrop-blur-md">
                  Config / 配置
              </button>
          ) : (
             <div className="flex flex-col gap-4 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 w-64">
                
                {/* Density */}
                <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-widest text-gray-400 block text-center">Density / 密度</label>
                    <div className="flex gap-2 justify-center">
                        {(['low', 'med', 'high'] as const).map(d => (
                            <button key={d} onClick={() => setDensity(d)}
                                className={`flex-1 py-1 text-[9px] border rounded uppercase ${density === d ? 'bg-green-500 text-black border-green-500' : 'text-gray-500 border-gray-600'}`}>
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color Mode */}
                <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-widest text-gray-400 block text-center">Palette / 配色</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(['matrix', 'cyan', 'white', 'rgb'] as const).map(c => (
                            <button key={c} onClick={() => setColorMode(c)}
                                className={`py-1 text-[9px] border rounded uppercase ${colorMode === c ? 'bg-white text-black border-white' : 'text-gray-500 border-gray-600'}`}>
                                {c === 'matrix' ? 'Green' : c === 'rgb' ? 'True Color' : c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <button onClick={takeSnapshot} className="w-full py-2 mt-1 border border-white/40 text-white rounded uppercase text-[10px] hover:bg-white/10 flex items-center justify-center gap-2">
                    <span>◉</span> Snapshot / 拍照
                </button>

                <button onClick={() => setShowControls(false)} className="text-[9px] text-gray-500 uppercase mt-1">Close / 关闭</button>
             </div>
          )}
      </div>
    </div>
  );
};

export default BioMesh;