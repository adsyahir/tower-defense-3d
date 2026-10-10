import { parseRunSave, type RunSave } from '../game/save';

/**
 * Everything the game remembers lives in this browser's localStorage: settings, best result,
 * and the run in progress. No accounts and no personal data. Storage can be unavailable
 * (private mode, blocked site data), so every access is guarded and falls back to defaults.
 */

export type Graphics = 'auto' | 'low' | 'high';

export interface Settings {
  /** 0..1 */
  volume: number;
  muted: boolean;
  graphics: Graphics;
  reducedMotion: boolean;
}

export interface Progress {
  /** Highest wave number reached. */
  bestWave: number;
  wins: number;
}

const KEYS = { settings: 'td3d.settings', progress: 'td3d.progress', run: 'td3d.run', help: 'td3d.helpSeen' };
const LEGACY_MUTED = 'td3d.muted';

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // unavailable or full: the game still works, it just won't remember
  }
}

const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

export function loadSettings(): Settings {
  const d = (read(KEYS.settings) ?? {}) as Record<string, unknown>;
  const legacyMuted = read(LEGACY_MUTED) === 1;
  return {
    volume: num(d.volume, 0, 1, 0.8),
    muted: typeof d.muted === 'boolean' ? d.muted : legacyMuted,
    graphics: d.graphics === 'low' || d.graphics === 'high' ? d.graphics : 'auto',
    reducedMotion:
      typeof d.reducedMotion === 'boolean' ? d.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

export function saveSettings(s: Settings): void {
  write(KEYS.settings, s);
}

export function loadProgress(): Progress {
  const d = (read(KEYS.progress) ?? {}) as Record<string, unknown>;
  return { bestWave: num(d.bestWave, 0, 999, 0), wins: num(d.wins, 0, 1e6, 0) };
}

export function saveProgress(p: Progress): void {
  write(KEYS.progress, p);
}

export function loadRun(): RunSave | null {
  return parseRunSave(read(KEYS.run));
}

/** Pass null to delete the saved run. */
export function saveRun(run: RunSave | null): void {
  write(KEYS.run, run);
}

export function helpSeen(): boolean {
  return read(KEYS.help) === true;
}

export function markHelpSeen(): void {
  write(KEYS.help, true);
}

/** Forgets best result and the saved run (settings are kept). */
export function clearProgress(): void {
  write(KEYS.progress, null);
  write(KEYS.run, null);
}
