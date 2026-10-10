import type { Game } from './Game';
import { damageEnemy } from './enemies';
import type { Enemy, Projectile, Vec2 } from './types';

const HIT_RADIUS = 0.2;

export function createProjectile(): Projectile {
  return {
    id: 0,
    active: false,
    pos: { x: 0, z: 0 },
    target: null,
    targetId: 0,
    lastTargetPos: { x: 0, z: 0 },
    speed: 0,
    damage: 0,
  };
}

export function fireProjectile(game: Game, from: Vec2, target: Enemy, speed: number, damage: number): Projectile {
  const p = game.projectiles.acquire();
  p.id = game.nextId();
  p.pos.x = from.x;
  p.pos.z = from.z;
  p.target = target;
  p.targetId = target.id;
  p.lastTargetPos.x = target.pos.x;
  p.lastTargetPos.z = target.pos.z;
  p.speed = speed;
  p.damage = damage;
  game.events.emit('projectileFired', p);
  return p;
}

/** Homing projectiles. If the target dies first, they fly to its last position and fizzle. */
export function updateProjectiles(game: Game, dt: number): void {
  const items = game.projectiles.items;
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (!p.active) continue;
    const t = p.target;
    const alive = t !== null && t.active && t.id === p.targetId;
    if (alive) {
      p.lastTargetPos.x = t.pos.x;
      p.lastTargetPos.z = t.pos.z;
    }
    const dx = p.lastTargetPos.x - p.pos.x;
    const dz = p.lastTargetPos.z - p.pos.z;
    const dist = Math.hypot(dx, dz);
    const step = p.speed * dt;
    if (dist <= HIT_RADIUS || step >= dist) {
      p.pos.x = p.lastTargetPos.x;
      p.pos.z = p.lastTargetPos.z;
      game.projectiles.release(p);
      if (alive) {
        game.events.emit('projectileHit', p);
        damageEnemy(game, t, p.damage);
      }
      p.target = null;
      continue;
    }
    p.pos.x += (dx / dist) * step;
    p.pos.z += (dz / dist) * step;
  }
}
