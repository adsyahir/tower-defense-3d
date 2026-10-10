import type { EnemyType, TowerType } from '../game/types';

export interface EnemyStats {
  hp: number;
  speed: number;
  reward: number;
  lifeCost: number;
}

export interface TowerStats {
  /** Level 1: build cost. Higher levels: upgrade cost to reach that level. */
  cost: number;
  range: number;
  /** Shots per second. */
  fireRate: number;
  damage: number;
  projectileSpeed: number;
  /** Area damage radius; omitted = single target. */
  splash?: number;
  /** Speed multiplier applied to targets hit (0.5 = half speed); omitted = no slow. */
  slow?: number;
  slowDuration?: number;
}

export interface TowerDef {
  name: string;
  levels: TowerStats[];
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
    arrow: {
      name: 'Ballista',
      levels: [
        { cost: 40, range: 2.6, fireRate: 2, damage: 5, projectileSpeed: 12 },
        { cost: 50, range: 2.9, fireRate: 2.4, damage: 8, projectileSpeed: 13 },
        { cost: 90, range: 3.2, fireRate: 3, damage: 12, projectileSpeed: 14 },
      ],
    },
    cannon: {
      name: 'Cannon',
      levels: [
        { cost: 70, range: 2.3, fireRate: 0.75, damage: 22, projectileSpeed: 7.5, splash: 0.9 },
        { cost: 80, range: 2.5, fireRate: 0.85, damage: 34, projectileSpeed: 8, splash: 1.05 },
        { cost: 140, range: 2.7, fireRate: 0.95, damage: 50, projectileSpeed: 8.5, splash: 1.2 },
      ],
    },
    frost: {
      name: 'Frost',
      levels: [
        { cost: 60, range: 2.2, fireRate: 1.2, damage: 3, projectileSpeed: 9, slow: 0.55, slowDuration: 1.5 },
        { cost: 60, range: 2.5, fireRate: 1.4, damage: 5, projectileSpeed: 10, slow: 0.45, slowDuration: 2 },
        { cost: 110, range: 2.8, fireRate: 1.6, damage: 8, projectileSpeed: 11, slow: 0.35, slowDuration: 2.5 },
      ],
    },
  } as Record<TowerType, TowerDef>,
  /** Share of the gold spent on a tower that selling returns. */
  sellRefund: 0.7,
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
