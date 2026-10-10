/** Point on the ground plane. Rendering maps this to Vector3(x, y, z). */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Tile {
  col: number;
  row: number;
}

export type Phase = 'build' | 'wave' | 'gameover' | 'victory';

export type EnemyType = 'basic' | 'fast' | 'tank';
export type TowerType = 'arrow' | 'cannon' | 'frost';

export interface MapDef {
  cols: number;
  rows: number;
  /** Tile coordinates; consecutive waypoints must share a row or a column. */
  waypoints: Tile[];
}

export interface Enemy {
  id: number;
  active: boolean;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  lifeCost: number;
  /** Distance travelled along the path. */
  distance: number;
  pos: Vec2;
  /** Unit direction of travel. */
  dir: Vec2;
  /** Speed multiplier while slowed (1 = normal). */
  slowFactor: number;
  /** Seconds of slow remaining. */
  slowTime: number;
}

export interface Tower {
  id: number;
  type: TowerType;
  /** 1-based; stats come from balance.towers[type].levels[level - 1]. */
  level: number;
  /** Total gold invested (build + upgrades), for the sell refund. */
  spent: number;
  tile: Tile;
  pos: Vec2;
  cooldown: number;
  target: Enemy | null;
  /** Id the target had when acquired; pooled enemies are reused, so compare ids. */
  targetId: number;
  /** Turret yaw in radians (atan2 of the aim direction). */
  aim: number;
}

export interface Projectile {
  id: number;
  active: boolean;
  pos: Vec2;
  target: Enemy | null;
  targetId: number;
  lastTargetPos: Vec2;
  speed: number;
  damage: number;
  /** Tower type that fired it (render uses this for the look). */
  kind: TowerType;
  /** Area damage radius on impact; 0 = single target. */
  splash: number;
  /** Speed multiplier applied on hit; 1 = no slow. */
  slow: number;
  slowDuration: number;
}

export interface GameState {
  phase: Phase;
  gold: number;
  lives: number;
  /** Number of waves started so far. */
  wave: number;
  time: number;
}
