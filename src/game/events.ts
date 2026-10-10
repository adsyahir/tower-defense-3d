import type { Enemy, Phase, Projectile, Tile, Tower } from './types';

export interface GameEvents {
  enemySpawned: Enemy;
  enemyKilled: Enemy;
  enemyLeaked: Enemy;
  towerPlaced: Tower;
  towerUpgraded: Tower;
  towerSold: { tower: Tower; refund: number };
  placeFailed: { tile: Tile; reason: 'blocked' | 'gold' };
  projectileFired: Projectile;
  projectileHit: Projectile;
  waveStarted: number;
  waveCleared: number;
  goldChanged: number;
  livesChanged: number;
  phaseChanged: Phase;
  reset: void;
  /** A saved run was restored (after reset + towerPlaced events). */
  loaded: void;
}

type Listener<T> = (payload: T) => void;

export class Emitter<E> {
  private listeners: { [K in keyof E]?: Listener<E[K]>[] } = {};

  /** Returns an unsubscribe function. */
  on<K extends keyof E>(name: K, fn: Listener<E[K]>): () => void {
    (this.listeners[name] ??= []).push(fn);
    return () => this.off(name, fn);
  }

  off<K extends keyof E>(name: K, fn: Listener<E[K]>): void {
    const list = this.listeners[name];
    if (list) list.splice(list.indexOf(fn) >>> 0, 1);
  }

  emit<K extends keyof E>(name: K, payload: E[K]): void {
    const list = this.listeners[name];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](payload);
  }
}
