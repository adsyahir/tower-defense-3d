import { balance } from '../config/balance';
import { createEnemy, spawnEnemy, updateEnemies } from './enemies';
import { Emitter, type GameEvents } from './events';
import { Grid, tileKey } from './grid';
import { Path } from './path';
import { Pool } from './pool';
import { createProjectile, updateProjectiles } from './projectiles';
import { buildCost, createTower, MAX_LEVEL, updateTowers } from './towers';
import type { EnemyType, GameState, MapDef, Phase, Tile, Tower, TowerType } from './types';
import { WaveScheduler } from './waves';

export type PlaceResult = 'ok' | 'blocked' | 'gold';
export type UpgradeResult = 'ok' | 'max' | 'gold';

/** Owns all game state. Pure logic: no three.js, no DOM. */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly grid: Grid;
  readonly path: Path;
  readonly enemies = new Pool(createEnemy, 100);
  readonly projectiles = new Pool(createProjectile, 200);
  readonly towers: Tower[] = [];
  readonly state: GameState = { phase: 'build', gold: 0, lives: 0, wave: 0, time: 0 };

  private readonly waves = new WaveScheduler();
  private readonly towerByTile = new Map<string, Tower>();
  private idCounter = 0;
  private readonly spawn = (type: EnemyType) => {
    spawnEnemy(this, type);
  };

  constructor(map: MapDef) {
    this.grid = new Grid(map);
    this.path = new Path(map.waypoints.map((t) => this.grid.tileToWorld(t, { x: 0, z: 0 })));
    this.reset();
  }

  get totalWaves(): number {
    return balance.waves.length;
  }

  nextId(): number {
    return ++this.idCounter;
  }

  update(dt: number): void {
    const s = this.state;
    if (s.phase === 'gameover' || s.phase === 'victory') return;
    s.time += dt;
    if (s.phase === 'wave') this.waves.update(dt, this.spawn);
    updateEnemies(this, dt);
    updateTowers(this, dt);
    updateProjectiles(this, dt);
    this.checkWaveEnd();
  }

  // ---- commands ----

  startWave(): boolean {
    const s = this.state;
    if (s.phase !== 'build' || s.wave >= this.totalWaves) return false;
    this.waves.start(balance.waves[s.wave]);
    s.wave++;
    this.setPhase('wave');
    this.events.emit('waveStarted', s.wave);
    return true;
  }

  canPlace(tile: Tile): boolean {
    return (
      this.grid.isInside(tile.col, tile.row) &&
      !this.grid.isPath(tile.col, tile.row) &&
      !this.towerByTile.has(tileKey(tile.col, tile.row))
    );
  }

  placeTower(type: TowerType, tile: Tile): PlaceResult {
    const s = this.state;
    const result: PlaceResult =
      s.phase === 'gameover' || s.phase === 'victory' || !this.canPlace(tile)
        ? 'blocked'
        : s.gold < buildCost(type)
          ? 'gold'
          : 'ok';
    if (result !== 'ok') {
      this.events.emit('placeFailed', { tile, reason: result });
      return result;
    }
    const tower = createTower(this.nextId(), type, tile, this);
    this.towers.push(tower);
    this.towerByTile.set(tileKey(tile.col, tile.row), tower);
    this.addGold(-tower.spent);
    this.events.emit('towerPlaced', tower);
    return 'ok';
  }

  /** Gold needed for the next level, or null at max level. */
  upgradeCost(tower: Tower): number | null {
    return tower.level >= MAX_LEVEL ? null : balance.towers[tower.type].levels[tower.level].cost;
  }

  upgradeTower(tower: Tower): UpgradeResult {
    const cost = this.upgradeCost(tower);
    if (cost === null) return 'max';
    if (this.state.gold < cost || this.isOver()) return 'gold';
    tower.level++;
    tower.spent += cost;
    this.addGold(-cost);
    this.events.emit('towerUpgraded', tower);
    return 'ok';
  }

  sellValue(tower: Tower): number {
    // Epsilon: 90 * 0.7 is 62.999... in floating point.
    return Math.floor(tower.spent * balance.sellRefund + 1e-9);
  }

  /** Removes the tower and refunds part of its cost. Returns the refund. */
  sellTower(tower: Tower): number {
    const i = this.towers.indexOf(tower);
    if (i < 0 || this.isOver()) return 0;
    this.towers.splice(i, 1);
    this.towerByTile.delete(tileKey(tower.tile.col, tower.tile.row));
    const refund = this.sellValue(tower);
    this.addGold(refund);
    this.events.emit('towerSold', { tower, refund });
    return refund;
  }

  towerAt(tile: Tile): Tower | undefined {
    return this.towerByTile.get(tileKey(tile.col, tile.row));
  }

  addGold(amount: number): void {
    this.state.gold += amount;
    this.events.emit('goldChanged', this.state.gold);
  }

  loseLives(amount: number): void {
    const s = this.state;
    if (s.phase === 'gameover') return;
    s.lives = Math.max(0, s.lives - amount);
    this.events.emit('livesChanged', s.lives);
    if (s.lives === 0) this.setPhase('gameover');
  }

  reset(): void {
    const s = this.state;
    this.enemies.releaseAll();
    this.projectiles.releaseAll();
    this.towers.length = 0;
    this.towerByTile.clear();
    this.waves.clear();
    s.gold = balance.startGold;
    s.lives = balance.startLives;
    s.wave = 0;
    s.time = 0;
    s.phase = 'build';
    this.events.emit('reset', undefined);
    this.events.emit('goldChanged', s.gold);
    this.events.emit('livesChanged', s.lives);
    this.events.emit('phaseChanged', s.phase);
  }

  // ---- internals ----

  private isOver(): boolean {
    return this.state.phase === 'gameover' || this.state.phase === 'victory';
  }

  private setPhase(phase: Phase): void {
    if (this.state.phase === phase) return;
    this.state.phase = phase;
    this.events.emit('phaseChanged', phase);
  }

  private checkWaveEnd(): void {
    const s = this.state;
    if (s.phase !== 'wave' || !this.waves.done || this.enemies.activeCount > 0) return;
    this.events.emit('waveCleared', s.wave);
    if (s.wave >= this.totalWaves) {
      this.setPhase('victory');
      return;
    }
    this.addGold(balance.waveClearBonus);
    this.setPhase('build');
  }
}
