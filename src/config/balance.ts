import type { EnemyType, TowerType } from '../game/types';

export interface EnemyStats {
  hp: number;
  speed: number;
  reward: number;
  lifeCost: number;
}

export interface TowerStats {
  cost: number;
  range: number;
  /** Shots per second. */
  fireRate: number;
  damage: number;
  projectileSpeed: number;
}

export interface WaveGroup {
  type: EnemyType;
  count: number;
  /** Seconds between spawns in this group. */
  interval: number;
  /** Seconds after wave start before the first spawn. */
  delay: number;
}

export type WaveDef = WaveGroup[];

/**
 * Single source of tuning. Mutable on purpose: the debug GUI edits it live
 * and the game reads it whenever it needs a value.
 */
export const balance = {
  startGold: 100,
  startLives: 20,
  waveClearBonus: 20,
  enemies: {
    basic: { hp: 30, speed: 1.5, reward: 5, lifeCost: 1 },
    fast: { hp: 18, speed: 2.6, reward: 6, lifeCost: 1 },
    tank: { hp: 120, speed: 0.9, reward: 15, lifeCost: 3 },
  } satisfies Record<EnemyType, EnemyStats>,
  towers: {
    basic: { cost: 50, range: 2.5, fireRate: 1.5, damage: 10, projectileSpeed: 8 },
  } satisfies Record<TowerType, TowerStats>,
  waves: [
    [{ type: 'basic', count: 6, interval: 1.2, delay: 0 }],
    [{ type: 'basic', count: 10, interval: 1, delay: 0 }],
    [
      { type: 'basic', count: 8, interval: 1, delay: 0 },
      { type: 'fast', count: 5, interval: 0.8, delay: 4 },
    ],
    [{ type: 'fast', count: 14, interval: 0.6, delay: 0 }],
    [
      { type: 'tank', count: 3, interval: 3, delay: 0 },
      { type: 'basic', count: 12, interval: 0.8, delay: 2 },
    ],
    [
      { type: 'basic', count: 15, interval: 0.6, delay: 0 },
      { type: 'fast', count: 10, interval: 0.5, delay: 5 },
    ],
    [{ type: 'tank', count: 8, interval: 2, delay: 0 }],
    [
      { type: 'fast', count: 20, interval: 0.4, delay: 0 },
      { type: 'tank', count: 5, interval: 2, delay: 3 },
    ],
    [
      { type: 'basic', count: 25, interval: 0.4, delay: 0 },
      { type: 'tank', count: 8, interval: 1.5, delay: 4 },
    ],
    [
      { type: 'tank', count: 12, interval: 1.2, delay: 0 },
      { type: 'fast', count: 25, interval: 0.35, delay: 2 },
      { type: 'basic', count: 20, interval: 0.5, delay: 6 },
    ],
  ] satisfies WaveDef[] as WaveDef[],
};
