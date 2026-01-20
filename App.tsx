import React, { useState, useEffect } from 'react';
import { ChamberId } from './types';
import { audioService } from './services/audioService';
import Navigation from './components/Navigation';
import Intro from './components/Intro';
import Spectrum from './components/chambers/Spectrum';
import BioMesh from './components/chambers/BioMesh';
import Console from './components/chambers/Console';
import Source from './components/chambers/Source';
import TattooInk from './components/chambers/TattooInk';

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [activeChamber, setActiveChamber] = useState<ChamberId>('spectrum');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const initSystem = async () => {
    try {
      );
          audioService.init().catch(() => console.log('Audio init skipped'));
    audioService.resume().catch(() => console.log('Audio resume skipped'));
      
      // Request Camera
      try {
          const s = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              facingMode: 'user' 
            } 
          });
          setStream(s);
      } catch (err) {
          console.warn("Camera access denied or unavailable", err);
      }
      
      setStarted(true);
    } catch (e) {
      console.error("Initialization failed", e);
    }
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden relative font-sans">
      {!started && <Intro onStart={initSystem} />}
      
      <div className={`transition-opacity duration-1000 ${started ? 'opacity-100' : 'opacity-0'}`}>
        <Navigation active={activeChamber} onChange={setActiveChamber} />
        
        {/* CRT Overlay Effect */}
        <div className="absolute inset-0 z-[60] crt-overlay pointer-events-none mix-blend-overlay opacity-30"></div>

        <main className="absolute inset-0 w-full h-full">
            {activeChamber === 'spectrum' && <Spectrum />}
            {activeChamber === 'biomesh' && <BioMesh stream={stream} />}
            {activeChamber === 'console' && <Console />}
            {activeChamber === 'source' && <Source stream={stream} />}
            {activeChamber === 'ink' && <TattooInk stream={stream} />}
        </main>
      </div>
    </div>
  );
};

export default App;
