import { PerformanceMode } from '../types';

export const MB = 1024 * 1024;

export interface PerformanceModeDef {
  id: PerformanceMode;
  label: string;
  bufferBytes: number;
  desc: string;
}

export const PERFORMANCE_MODES: PerformanceModeDef[] = [
  {
    id: 'eco',
    label: 'Eco',
    bufferBytes: 16 * MB,
    desc: '16 MB buffer',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    bufferBytes: 32 * MB,
    desc: '32 MB buffer',
  },
  {
    id: 'turbo',
    label: 'Turbo',
    bufferBytes: 64 * MB,
    desc: '64 MB buffer',
  },
];

export const MAX_BUFFER_BYTES = 64 * MB;

export const DEFAULT_PERFORMANCE_MODE: PerformanceMode = 'balanced';

export function getBufferBytes(mode: PerformanceMode): number {
  const bytes = PERFORMANCE_MODES.find(m => m.id === mode)?.bufferBytes ?? 32 * MB;
  return Math.min(bytes, MAX_BUFFER_BYTES);
}
