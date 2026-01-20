import React from 'react';
import { ChamberId } from '../types';

interface NavigationProps {
  active: ChamberId;
  onChange: (id: ChamberId) => void;
}

const Navigation: React.FC<NavigationProps> = ({ active, onChange }) => {
  const chambers: { id: ChamberId; label: string; icon: string }[] = [
    { id: 'spectrum', label: 'PRISM', icon: '◈' },
    { id: 'biomesh', label: 'BIOMESH', icon: '◉' },
    { id: 'console', label: 'CONSOLE', icon: '◎' },
    { id: 'source', label: 'SOURCE', icon: '▣' },
    { id: 'ink', label: 'TATTOO', icon: '✦' },
  ];

  return (
    <nav className="fixed md:absolute z-50 transition-all duration-500
      /* Mobile: Bottom Dock with glassmorphism */
      bottom-6 left-4 right-4 md:bottom-auto md:top-8 md:left-1/2 md:right-auto md:transform md:-translate-x-1/2
      flex md:inline-flex justify-between md:justify-center items-center gap-2 
      p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-full shadow-2xl
    ">
      {chambers.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`
            flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center gap-1 md:gap-3
            px-1 md:px-6 py-2 md:py-3 rounded-xl md:rounded-full transition-all duration-300
            ${active === c.id 
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] transform scale-105' 
              : 'text-white/40 hover:text-white hover:bg-white/5 active:scale-95'}
          `}
        >
          <span className="text-xl md:text-xs leading-none">{c.icon}</span>
          <span className="text-[8px] md:text-[10px] tracking-widest font-semibold uppercase hidden md:block">{c.label}</span>
          {/* Mobile Label */}
          <span className="text-[8px] tracking-widest font-semibold uppercase md:hidden opacity-70 mt-1">{c.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default Navigation;