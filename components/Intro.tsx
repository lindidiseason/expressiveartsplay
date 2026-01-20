import React from 'react';

const Intro: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1)_0%,_black_100%)]"></div>
      
      <div className="relative z-10 text-center space-y-12">
        <div className="space-y-2 mix-blend-difference">
          <h1 className="text-6xl md:text-8xl font-['Syncopate'] font-bold tracking-tighter">SENSORIUM</h1>
          <p className="text-sm md:text-lg tracking-[0.8em] font-light text-gray-400">GENESIS</p>
        </div>

        <button 
          onClick={onStart}
          className="group relative px-12 py-4 bg-transparent overflow-hidden rounded-full transition-all hover:scale-105"
        >
          <div className="absolute inset-0 border border-white/20 rounded-full"></div>
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
          <span className="relative text-xs tracking-[0.3em] font-semibold">INITIALIZE SYSTEM</span>
        </button>
        
        <p className="text-[10px] text-gray-600 tracking-widest mt-8">HEADPHONES & CAMERA RECOMMENDED</p>
      </div>
    </div>
  );
};

export default Intro;