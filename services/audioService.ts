import { AudioScale, Waveform } from '../types';

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null; // New Expressive Filter
  private analyser: AnalyserNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;

  public init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

    // Expressive Filter (Lowpass by default, opens up)
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000; // Open by default
    this.masterFilter.Q.value = 1;
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.85;

    // Effects: Reverb
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(2.5, 2.0, false);
    
    // Effects: Delay
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.3;
    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.value = 0.4;

    // Routing: 
    // Inputs -> [Delay/Reverb] -> MasterGain -> MasterFilter -> Analyser -> Destination

    this.masterGain.connect(this.masterFilter);
    this.masterFilter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Reverb loop
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.4;
    this.reverbNode.connect(reverbGain);
    reverbGain.connect(this.masterGain);

    // Delay loop
    this.delayNode.connect(delayFeedback);
    delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.masterGain);
  }

  // Create artificial reverb sound without loading a file
  private createImpulseResponse(duration: number, decay: number, reverse: boolean): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx!.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = reverse ? length - i : i;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    return impulse;
  }

  public async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // New: Expressive Control
  // value: 0 to 1. 
  // 0 = Muffled (Lowpass 200Hz)
  // 1 = Sharp/Thin (Highpass 15kHz)
  public setExpressiveFilter(value: number) {
      if (!this.masterFilter || !this.ctx) return;
      
      const minFreq = 200;
      const maxFreq = 15000;
      // Exponential ramp
      const freq = minFreq * Math.pow(maxFreq / minFreq, value);
      
      this.masterFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
  }

  public getAnalyserData(dataArray: Uint8Array, mode: 'time' | 'freq') {
    if (!this.analyser) return;
    if (mode === 'time') {
      this.analyser.getByteTimeDomainData(dataArray);
    } else {
      this.analyser.getByteFrequencyData(dataArray);
    }
  }

  public getNoteFrequency(index: number, scaleType: AudioScale, rootFreq: number = 110): number {
    const scales: Record<AudioScale, number[]> = {
        pentatonic: [1, 1.125, 1.25, 1.5, 1.66],
        phrygian:   [1, 1.06, 1.25, 1.33, 1.5],
        chromatic:  [1, 1.059, 1.122, 1.189, 1.26]
    };

    const selectedScale = scales[scaleType];
    const octave = Math.floor(index / selectedScale.length);
    const noteIndex = Math.floor(index % selectedScale.length);
    const ratio = selectedScale[noteIndex];
    const detune = 1 + (Math.random() * 0.01 - 0.005); 

    return rootFreq * ratio * Math.pow(2, octave) * detune;
  }

  public playPing(freq: number, panX: number, type: Waveform = 'sine') {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    panner.pan.value = Math.max(-1, Math.min(1, (panX * 2) - 1));

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain); // Goes through Filter
    
    // Effect Sends
    if (this.reverbNode) panner.connect(this.reverbNode);
    // Route High frequency pings to Delay automatically for "sparkle"
    if (this.delayNode && freq > 400) panner.connect(this.delayNode);

    osc.start();
    osc.stop(now + 2.0);

    setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
        panner.disconnect();
    }, 2000);
  }
}

export const audioService = new AudioService();