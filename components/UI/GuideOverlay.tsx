import React, { useState } from 'react';

interface GuideOverlayProps {
  title: string;
  titleCn?: string;
  rules: { en: string; cn: string }[];
}

const GuideOverlay: React.FC<GuideOverlayProps> = ({ title, titleCn, rules }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full border border-white/20 text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
      >
        ?
      </button>

      {isOpen && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-8" onClick={() => setIsOpen(false)}>
          <div className="max-w-md w-full border border-white/10 bg-black/90 p-6 rounded-2xl shadow-2xl relative max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-white/30 hover:text-white"
            >
                ✕
            </button>
            <div className="mb-6 border-b border-white/10 pb-4">
                <h2 className="text-xl font-['Syncopate'] font-bold text-white tracking-widest">{title}</h2>
                {titleCn && <h3 className="text-lg text-white/60 font-sans font-light tracking-widest mt-1">{titleCn}</h3>}
            </div>
            
            <ul className="space-y-6 font-mono text-sm text-gray-300">
              {rules.map((rule, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-pink-500 font-bold text-xs mt-1">0{i+1}</span>
                  <div className="flex flex-col gap-1">
                      <span className="text-white font-medium">{rule.en}</span>
                      <span className="text-white/50 text-xs">{rule.cn}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 pt-4 border-t border-white/10 text-center text-[10px] text-gray-600 tracking-[0.2em] uppercase">
                Tap to close / 点击关闭
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuideOverlay;