export type ChamberId = 'spectrum' | 'biomesh' | 'console' | 'source' | 'ink';

export interface Point {
  x: number;
  y: number;
}

export interface AudioNodeData {
  id: string;
  x: number; // 0-1
  y: number; // 0-1
  active: boolean;
  frequency: number;
  life: number; // For visual decay
}

export interface VisualizerConfig {
  mode: 'particles' | 'bars';
  sensitivity: number;
  color: string;
}

export interface KaleidoscopeConfig {
  slices: number;
  zoom: number;
  rotationSpeed: number;
}

export type AudioScale = 'pentatonic' | 'phrygian' | 'chromatic';
export type Waveform = 'sine' | 'triangle' | 'square';

export interface ConsoleConfig {
  scale: AudioScale;
  waveform: Waveform;
  tempo: number;
}

export interface InkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  history: Point[];
  hue: number;
  size: number;
}