import type { TowerType } from './types';

export const SAVE_VERSION = 1;

export interface TowerSave {
  type: TowerType;
  level: number;
  col: number;
  row: number;
  spent: number;
}

/** A run between waves: everything needed to continue later. No personal data. */
export interface RunSave {
  v: number;
  /** Waves already started (= cleared, since saves happen between waves). */
  wave: number;
  gold: number;
  lives: number;
  towers: TowerSave[];
}

const TOWER_TYPES: readonly string[] = ['arrow', 'cannon', 'frost'] satisfies TowerType[];

const isInt = (n: unknown, min = 0): n is number => Number.isInteger(n) && (n as number) >= min;

/**
 * Validates untrusted data (e.g. from localStorage) into a RunSave, or null.
 * Bad towers are dropped individually; Game.restore checks tiles and clamps levels.
 */
export function parseRunSave(data: unknown): RunSave | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.v !== SAVE_VERSION || !isInt(d.wave) || !isInt(d.gold) || !isInt(d.lives, 1) || !Array.isArray(d.towers)) {
    return null;
  }
  const towers: TowerSave[] = [];
  for (const t of d.towers as unknown[]) {
    if (typeof t !== 'object' || t === null) continue;
    const x = t as Record<string, unknown>;
    if (typeof x.type !== 'string' || !TOWER_TYPES.includes(x.type)) continue;
    if (!isInt(x.level, 1) || !isInt(x.col) || !isInt(x.row) || !isInt(x.spent)) continue;
    towers.push({ type: x.type as TowerType, level: x.level, col: x.col, row: x.row, spent: x.spent });
  }
  return { v: SAVE_VERSION, wave: d.wave, gold: d.gold, lives: d.lives, towers };
}
