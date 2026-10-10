import { beforeEach, describe, expect, it } from 'vitest';
import { balance } from '../config/balance';
import { map01 } from '../config/map01';
import { damageEnemy, spawnEnemy } from './enemies';
import { Game } from './Game';
import { fireProjectile } from './projectiles';
import { findTarget } from './towers';
import { WaveScheduler } from './waves';

/** Runs the game in fixed steps. */
function run(game: Game, seconds: number, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

let game: Game;
beforeEach(() => {
  game = new Game(map01);
});

describe('enemies', () => {
  it('walks the path and costs lives when it reaches the end', () => {
    const e = spawnEnemy(game, 'basic');
    e.speed = 1;
    run(game, game.path.totalLength + 0.1);
    expect(e.active).toBe(false);
    expect(game.state.lives).toBe(balance.startLives - balance.enemies.basic.lifeCost);
  });

  it('dies once and pays its reward once', () => {
    const e = spawnEnemy(game, 'basic');
    let kills = 0;
    game.events.on('enemyKilled', () => kills++);
    damageEnemy(game, e, 1000);
    damageEnemy(game, e, 1000);
    expect(kills).toBe(1);
    expect(game.state.gold).toBe(balance.startGold + balance.enemies.basic.reward);
  });

  it('ends the game at 0 lives', () => {
    game.loseLives(999);
    expect(game.state.phase).toBe('gameover');
  });
});

describe('towers', () => {
  it('cannot be placed on the path, on a tower, or without gold', () => {
    expect(game.placeTower('basic', { col: 0, row: 2 })).toBe('blocked');
    expect(game.placeTower('basic', { col: 99, row: 0 })).toBe('blocked');
    expect(game.placeTower('basic', { col: 1, row: 1 })).toBe('ok');
    expect(game.state.gold).toBe(balance.startGold - balance.towers.basic.cost);
    expect(game.placeTower('basic', { col: 1, row: 1 })).toBe('blocked');
    game.state.gold = 0;
    expect(game.placeTower('basic', { col: 2, row: 1 })).toBe('gold');
  });

  it('targets the nearest enemy in range and ignores ones out of range', () => {
    game.placeTower('basic', { col: 2, row: 1 });
    const tower = game.towers[0];
    const near = spawnEnemy(game, 'basic');
    const far = spawnEnemy(game, 'basic');
    near.pos.x = tower.pos.x + 1;
    near.pos.z = tower.pos.z;
    far.pos.x = tower.pos.x + 2;
    far.pos.z = tower.pos.z;
    expect(findTarget(game, tower, 2.5)).toBe(near);
    near.pos.x = tower.pos.x + 10;
    expect(findTarget(game, tower, 2.5)).toBe(far);
    far.pos.x = tower.pos.x + 10;
    expect(findTarget(game, tower, 2.5)).toBeNull();
  });
});

describe('projectiles', () => {
  it('reaches a stationary target and deals damage', () => {
    const e = spawnEnemy(game, 'tank');
    e.speed = 0;
    fireProjectile(game, { x: e.pos.x + 3, z: e.pos.z }, e, 8, 10);
    run(game, 1);
    expect(e.hp).toBe(balance.enemies.tank.hp - 10);
    expect(game.projectiles.activeCount).toBe(0);
  });

  it('fizzles without crashing when the target dies mid-flight', () => {
    const e = spawnEnemy(game, 'basic');
    e.speed = 0;
    const p = fireProjectile(game, { x: e.pos.x + 3, z: e.pos.z }, e, 8, 10);
    damageEnemy(game, e, 1000);
    const gold = game.state.gold;
    const reused = spawnEnemy(game, 'basic'); // likely reuses the same pooled object
    reused.speed = 0;
    run(game, 1);
    expect(p.active).toBe(false);
    expect(reused.hp).toBe(balance.enemies.basic.hp);
    expect(game.state.gold).toBe(gold);
  });
});

describe('waves', () => {
  it('spawns the right counts at the right times', () => {
    const w = new WaveScheduler();
    const spawned: string[] = [];
    w.start([
      { type: 'basic', count: 3, interval: 1, delay: 0 },
      { type: 'fast', count: 2, interval: 0.5, delay: 2 },
    ]);
    w.update(0, (t) => spawned.push(t));
    expect(spawned).toEqual(['basic']);
    w.update(1.5, (t) => spawned.push(t));
    expect(spawned).toEqual(['basic', 'basic']);
    expect(w.done).toBe(false);
    w.update(1.0, (t) => spawned.push(t));
    expect(spawned).toEqual(['basic', 'basic', 'basic', 'fast', 'fast']);
    expect(w.done).toBe(true);
  });

  it('goes build -> wave -> build with a bonus, then victory after the last wave', () => {
    expect(game.startWave()).toBe(true);
    expect(game.state.phase).toBe('wave');
    expect(game.startWave()).toBe(false);
    // kill everything as it spawns
    game.events.on('enemySpawned', (e) => damageEnemy(game, e, 1e9));
    const goldBefore = game.state.gold;
    run(game, 60);
    expect(game.state.phase).toBe('build');
    const kills = balance.waves[0].reduce((n, g) => n + g.count, 0);
    expect(game.state.gold).toBe(goldBefore + kills * balance.enemies.basic.reward + balance.waveClearBonus);
    for (let i = 1; i < game.totalWaves; i++) {
      game.startWave();
      run(game, 60);
    }
    expect(game.state.phase).toBe('victory');
  });

  it('reset restores everything', () => {
    game.placeTower('basic', { col: 1, row: 1 });
    game.startWave();
    run(game, 5);
    game.reset();
    expect(game.state).toMatchObject({ phase: 'build', gold: balance.startGold, lives: balance.startLives, wave: 0 });
    expect(game.towers.length).toBe(0);
    expect(game.enemies.activeCount).toBe(0);
    expect(game.projectiles.activeCount).toBe(0);
    expect(game.placeTower('basic', { col: 1, row: 1 })).toBe('ok');
  });
});
