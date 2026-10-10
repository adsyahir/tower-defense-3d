import type { TowerStats } from '../config/balance';
import type { Game } from './Game';
import { damageEnemy, slowEnemy } from './enemies';
import type { Enemy, Projectile, Tower, TowerType, Vec2 } from './types';

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
    kind: 'arrow',
    source: null,
    splash: 0,
    slow: 1,
    slowDuration: 0,
  };
}

/** Returns null (no shot) if the projectile pool is full. */
export function fireProjectile(
  game: Game,
  from: Vec2,
  target: Enemy,
  stats: TowerStats,
  kind: TowerType,
  source: Tower | null = null,
): Projectile | null {
  const p = game.projectiles.acquire();
  if (!p) return null;
  p.id = game.nextId();
  p.pos.x = from.x;
  p.pos.z = from.z;
  p.target = target;
  p.targetId = target.id;
  p.lastTargetPos.x = target.pos.x;
  p.lastTargetPos.z = target.pos.z;
  p.speed = stats.projectileSpeed;
  p.damage = stats.damage;
  p.kind = kind;
  p.source = source;
  p.splash = stats.splash ?? 0;
  p.slow = stats.slow ?? 1;
  p.slowDuration = stats.slowDuration ?? 0;
  game.events.emit('projectileFired', p);
  return p;
}

function hitEnemy(game: Game, p: Projectile, e: Enemy): void {
  if (p.slow < 1) slowEnemy(e, p.slow, p.slowDuration);
  damageEnemy(game, e, p.damage);
}

/**
 * Homing projectiles. If the target dies first, they fly to its last position:
 * splash shots still explode there, single-target shots fizzle.
 */
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
      if (p.splash > 0) {
        game.events.emit('projectileHit', p);
        const r2 = p.splash * p.splash;
        const enemies = game.enemies.items;
        for (let k = 0; k < enemies.length; k++) {
          const e = enemies[k];
          if (!e.active) continue;
          const ex = e.pos.x - p.pos.x;
          const ez = e.pos.z - p.pos.z;
          if (ex * ex + ez * ez <= r2) hitEnemy(game, p, e);
        }
      } else if (alive) {
        game.events.emit('projectileHit', p);
        hitEnemy(game, p, t);
      }
      p.target = null;
      p.source = null;
      continue;
    }
    p.pos.x += (dx / dist) * step;
    p.pos.z += (dz / dist) * step;
  }
}
