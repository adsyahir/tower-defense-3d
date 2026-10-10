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
export type TowerType = 'basic';

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
}

export interface Tower {
  id: number;
  type: TowerType;
  level: number;
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
}

export interface GameState {
  phase: Phase;
  gold: number;
  lives: number;
  /** Number of waves started so far. */
  wave: number;
  time: number;
}
