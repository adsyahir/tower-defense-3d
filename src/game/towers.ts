import { balance } from '../config/balance';
import type { Game } from './Game';
import { fireProjectile } from './projectiles';
import type { Enemy, Tile, Tower, TowerType } from './types';

export function createTower(id: number, type: TowerType, tile: Tile, game: Game): Tower {
  const pos = game.grid.tileToWorld(tile, { x: 0, z: 0 });
  return { id, type, level: 1, tile: { ...tile }, pos, cooldown: 0, target: null, targetId: 0, aim: 0 };
}

/** Nearest active enemy within range, or null. */
export function findTarget(game: Game, tower: Tower, range: number): Enemy | null {
  const r2 = range * range;
  let best: Enemy | null = null;
  let bestD2 = Infinity;
  const items = game.enemies.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active) continue;
    const dx = e.pos.x - tower.pos.x;
    const dz = e.pos.z - tower.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 <= r2 && d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best;
}

export function updateTowers(game: Game, dt: number): void {
  for (const tower of game.towers) {
    const stats = balance.towers[tower.type];
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    const target = findTarget(game, tower, stats.range);
    tower.target = target;
    tower.targetId = target ? target.id : 0;
    if (!target) continue;
    tower.aim = Math.atan2(target.pos.x - tower.pos.x, target.pos.z - tower.pos.z);
    if (tower.cooldown === 0) {
      fireProjectile(game, tower.pos, target, stats.projectileSpeed, stats.damage);
      tower.cooldown = 1 / stats.fireRate;
    }
  }
}
