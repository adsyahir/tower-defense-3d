import { beforeEach, describe, expect, it } from 'vitest';
import { balance, type TowerStats } from '../config/balance';
import { map01 } from '../config/map01';
import { slowEnemy, spawnEnemy } from './enemies';
import { Game } from './Game';
import { fireProjectile } from './projectiles';
import { buildCost, towerStats } from './towers';

function run(game: Game, seconds: number, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

const shot = (o: Partial<TowerStats>): TowerStats => ({
  cost: 0,
  range: 3,
  fireRate: 1,
  damage: 10,
  projectileSpeed: 8,
  ...o,
});

let game: Game;
beforeEach(() => {
  game = new Game(map01);
  game.state.gold = 10_000;
});

describe('tower types', () => {
  it('has ballista, cannon and frost, each with 3 levels', () => {
    for (const type of ['arrow', 'cannon', 'frost'] as const) {
      expect(balance.towers[type].levels).toHaveLength(3);
      expect(buildCost(type)).toBe(balance.towers[type].levels[0].cost);
    }
  });

  it('charges the build cost of the chosen type', () => {
    game.placeTower('cannon', { col: 1, row: 1 });
    expect(game.state.gold).toBe(10_000 - buildCost('cannon'));
    expect(game.towers[0].type).toBe('cannon');
    expect(game.towers[0].spent).toBe(buildCost('cannon'));
  });
});

describe('upgrades', () => {
  it('raises the level, uses that level stats and costs the upgrade price', () => {
    game.placeTower('arrow', { col: 1, row: 1 });
    const t = game.towers[0];
    const cost = game.upgradeCost(t)!;
    expect(cost).toBe(balance.towers.arrow.levels[1].cost);
    let upgraded = 0;
    game.events.on('towerUpgraded', () => upgraded++);
    expect(game.upgradeTower(t)).toBe('ok');
    expect(t.level).toBe(2);
    expect(towerStats(t)).toBe(balance.towers.arrow.levels[1]);
    expect(t.spent).toBe(buildCost('arrow') + cost);
    expect(upgraded).toBe(1);
  });

  it('stops at max level and refuses without gold', () => {
    game.placeTower('arrow', { col: 1, row: 1 });
    const t = game.towers[0];
    game.upgradeTower(t);
    game.upgradeTower(t);
    expect(t.level).toBe(3);
    expect(game.upgradeCost(t)).toBeNull();
    expect(game.upgradeTower(t)).toBe('max');

    game.placeTower('arrow', { col: 2, row: 1 });
    game.state.gold = 0;
    expect(game.upgradeTower(game.towers[1])).toBe('gold');
    expect(game.towers[1].level).toBe(1);
  });
});

describe('selling', () => {
  it('refunds 70% of everything spent and frees the tile', () => {
    game.placeTower('cannon', { col: 1, row: 1 });
    const t = game.towers[0];
    game.upgradeTower(t);
    const value = game.sellValue(t);
    expect(value).toBe(Math.floor(t.spent * 0.7));
    const gold = game.state.gold;
    expect(game.sellTower(t)).toBe(value);
    expect(game.state.gold).toBe(gold + value);
    expect(game.towers).toHaveLength(0);
    expect(game.towerAt({ col: 1, row: 1 })).toBeUndefined();
    expect(game.canPlace({ col: 1, row: 1 })).toBe(true);
  });
});

describe('sell refund rounding', () => {
  it('is not lost to floating point (90 * 0.7 must be 63, not 62)', () => {
    game.placeTower('arrow', { col: 1, row: 1 });
    const t = game.towers[0];
    t.spent = 90;
    expect(game.sellValue(t)).toBe(63);
  });
});

describe('cannon splash', () => {
  it('damages every enemy within the splash radius of the impact', () => {
    const target = spawnEnemy(game, 'tank')!;
    const near = spawnEnemy(game, 'tank')!;
    const far = spawnEnemy(game, 'tank')!;
    // Place them by path distance (update() recomputes pos from it). First segment is 4 long.
    target.distance = 2;
    near.distance = 2.5; // 0.5 from target
    far.distance = 5; // round the corner, ~2.2 from target
    for (const e of [target, near, far]) {
      e.speed = 0;
      game.path.positionAt(e.distance, e.pos);
    }
    fireProjectile(game, { x: target.pos.x, z: target.pos.z + 2 }, target, shot({ damage: 20, splash: 1 }), 'cannon');
    run(game, 1);
    const hp = balance.enemies.tank.hp;
    expect(target.hp).toBe(hp - 20);
    expect(near.hp).toBe(hp - 20);
    expect(far.hp).toBe(hp);
  });
});

describe('frost slow', () => {
  it('slows the target for the slow duration, then it recovers', () => {
    const e = spawnEnemy(game, 'tank')!;
    e.speed = 1;
    fireProjectile(game, { x: e.pos.x, z: e.pos.z }, e, shot({ damage: 1, slow: 0.5, slowDuration: 1 }), 'frost');
    game.update(1 / 60); // hits immediately (fired from its own position)
    expect(e.slowTime).toBeGreaterThan(0.9);
    const d0 = e.distance;
    game.update(0.5);
    expect(e.distance - d0).toBeCloseTo(0.25, 5);
    game.update(0.6); // slow expires during this step
    const d1 = e.distance;
    game.update(0.5);
    expect(e.distance - d1).toBeCloseTo(0.5, 5);
    expect(e.slowTime).toBe(0);
  });

  it('frost towers actually apply slow when they fire', () => {
    game.placeTower('frost', { col: 1, row: 1 });
    const e = spawnEnemy(game, 'tank')!; // sits on the path start, next to the tower
    e.speed = 0;
    run(game, 1);
    expect(e.slowTime).toBeGreaterThan(0);
  });
});

describe('review fixes', () => {
  it('a weak long slow does not stretch a strong short one', () => {
    const e = spawnEnemy(game, 'tank')!;
    slowEnemy(e, 0.35, 0.1);
    slowEnemy(e, 0.55, 1.5);
    // Strong slow still active: the weaker one must not extend it at 0.35.
    expect(e.slowFactor * e.slowTime).not.toBeCloseTo(0.35 * 1.5, 5);
    expect(e.slowFactor === 0.35 ? e.slowTime : 0).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it('a stronger slow replaces a weaker one; an equal one refreshes the duration', () => {
    const e = spawnEnemy(game, 'tank')!;
    slowEnemy(e, 0.55, 1.5);
    slowEnemy(e, 0.35, 0.5);
    expect(e.slowFactor).toBe(0.35);
    expect(e.slowTime).toBe(0.5);
    slowEnemy(e, 0.35, 2);
    expect(e.slowTime).toBe(2);
  });

  it('cannot upgrade a sold tower or after the game ended', () => {
    game.placeTower('arrow', { col: 1, row: 1 });
    const t = game.towers[0];
    game.sellTower(t);
    const gold = game.state.gold;
    expect(game.upgradeTower(t)).toBe('invalid');
    expect(game.state.gold).toBe(gold);
    game.placeTower('arrow', { col: 2, row: 1 });
    game.loseLives(999);
    expect(game.upgradeTower(game.towers[0])).toBe('invalid');
  });

  it('skips shots instead of growing past the projectile cap', () => {
    const e = spawnEnemy(game, 'tank')!;
    e.speed = 0;
    for (let i = 0; i < 250; i++) fireProjectile(game, { x: 50, z: 50 }, e, shot({}), 'arrow');
    expect(game.projectiles.items.length).toBe(game.projectiles.capacity);
    expect(game.projectiles.activeCount).toBe(game.projectiles.capacity);
  });

  it('records which tower fired a projectile', () => {
    game.placeTower('arrow', { col: 1, row: 1 });
    const fired: unknown[] = [];
    game.events.on('projectileFired', (p) => fired.push(p.source));
    spawnEnemy(game, 'tank')!.speed = 0;
    run(game, 0.2);
    expect(fired[0]).toBe(game.towers[0]);
  });
});
