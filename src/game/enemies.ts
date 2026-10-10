import { balance } from '../config/balance';
import type { Game } from './Game';
import type { Enemy, EnemyType } from './types';

export function createEnemy(): Enemy {
  return {
    id: 0,
    active: false,
    type: 'basic',
    hp: 0,
    maxHp: 0,
    speed: 0,
    reward: 0,
    lifeCost: 0,
    distance: 0,
    pos: { x: 0, z: 0 },
    dir: { x: 1, z: 0 },
    slowFactor: 1,
    slowTime: 0,
  };
}

/** Returns null if the enemy pool is full (waves are designed to stay well below it). */
export function spawnEnemy(game: Game, type: EnemyType): Enemy | null {
  const stats = balance.enemies[type];
  const e = game.enemies.acquire();
  if (!e) return null;
  e.id = game.nextId();
  e.type = type;
  e.hp = e.maxHp = stats.hp;
  e.speed = stats.speed;
  e.reward = stats.reward;
  e.lifeCost = stats.lifeCost;
  e.distance = 0;
  e.slowFactor = 1;
  e.slowTime = 0;
  game.path.positionAt(0, e.pos, e.dir);
  game.events.emit('enemySpawned', e);
  return e;
}

export function updateEnemies(game: Game, dt: number): void {
  const items = game.enemies.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active) continue;
    let moveTime = dt;
    if (e.slowTime > 0) {
      // Slowed for part (or all) of this step.
      const slowed = Math.min(dt, e.slowTime);
      e.distance += e.speed * e.slowFactor * slowed;
      moveTime -= slowed;
      e.slowTime -= slowed;
      if (e.slowTime <= 1e-9) {
        e.slowTime = 0;
        e.slowFactor = 1;
      }
    }
    e.distance += e.speed * moveTime;
    game.path.positionAt(e.distance, e.pos, e.dir);
    if (e.distance >= game.path.totalLength) {
      game.enemies.release(e);
      game.events.emit('enemyLeaked', e);
      game.loseLives(e.lifeCost);
    }
  }
}

/** Applies damage; kills and rewards when hp drops to 0. Safe to call on a dead enemy. */
export function damageEnemy(game: Game, e: Enemy, amount: number): void {
  if (!e.active) return;
  e.hp -= amount;
  if (e.hp <= 0) {
    e.hp = 0;
    game.enemies.release(e);
    game.events.emit('enemyKilled', e);
    game.addGold(e.reward);
  }
}

/**
 * Applies a slow. Only one slow is active at a time: a stronger one replaces the current one,
 * an equally strong one refreshes its duration, and a weaker one is ignored while the current lasts.
 */
export function slowEnemy(e: Enemy, factor: number, duration: number): void {
  if (!e.active) return;
  if (e.slowTime <= 0 || factor < e.slowFactor) {
    e.slowFactor = factor;
    e.slowTime = duration;
  } else if (factor === e.slowFactor) {
    e.slowTime = Math.max(e.slowTime, duration);
  }
}
