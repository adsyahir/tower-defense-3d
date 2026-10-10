import {
  BoxGeometry,
  Color,
  ConeGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  type BufferGeometry,
} from 'three';
import type { Game } from '../game/Game';
import type { EnemyType } from '../game/types';
import { GeoBuilder, palette, PATH_Y, vcMaterial } from './style3d';

interface Motion {
  /** Hops per second (game time, so 2x speed animates 2x). */
  freq: number;
  hop: number;
  squash: number;
  waddle: number;
  /** Health bar height. */
  barY: number;
}

export const enemyColors: Record<EnemyType, string> = { basic: '#ef5a4c', fast: '#f6b93b', tank: '#7a5bc4' };

export const enemyMotion: Record<EnemyType, Motion> = {
  basic: { freq: 2.2, hop: 0.08, squash: 0.12, waddle: 0.12, barY: 0.72 },
  fast: { freq: 3.8, hop: 0.1, squash: 0.08, waddle: 0.05, barY: 0.62 },
  tank: { freq: 1.1, hop: 0.025, squash: 0.04, waddle: 0.07, barY: 0.86 },
};

// Models face +z, feet at y = 0.
const ball = new IcosahedronGeometry(1, 1);
const box = new BoxGeometry(1, 1, 1);
const cone = new ConeGeometry(1, 1, 5);

function eyes(b: GeoBuilder, x: number, y: number, z: number, r: number): void {
  for (const s of [-1, 1]) {
    b.add(ball, '#ffffff', s * x, y, z, { sx: r, sy: r, sz: r });
    b.add(ball, palette.metal, s * x, y, z + r * 0.75, { sx: r * 0.5, sy: r * 0.55, sz: r * 0.5 });
  }
}

function buildModels(): Record<EnemyType, BufferGeometry> {
  // basic: round slime with a leaf sprout
  const slime = new GeoBuilder()
    .add(ball, enemyColors.basic, 0, 0.22, 0, { sx: 0.27, sy: 0.23, sz: 0.27 })
    .add(ball, '#ff8a70', 0, 0.3, 0.06, { sx: 0.16, sy: 0.1, sz: 0.16 })
    .add(cone, palette.leafLight, 0, 0.5, 0, { rz: 0.4, sx: 0.06, sy: 0.14, sz: 0.06 });
  eyes(slime, 0.1, 0.3, 0.2, 0.075);

  // fast: lean critter with long ears and a tail
  const runner = new GeoBuilder()
    .add(ball, enemyColors.fast, 0, 0.2, 0, { sx: 0.17, sy: 0.15, sz: 0.27 })
    .add(cone, '#e0962a', 0.08, 0.38, -0.04, { rx: -0.35, rz: -0.2, sx: 0.05, sy: 0.24, sz: 0.05 })
    .add(cone, '#e0962a', -0.08, 0.38, -0.04, { rx: -0.35, rz: 0.2, sx: 0.05, sy: 0.24, sz: 0.05 })
    .add(cone, '#e0962a', 0, 0.24, -0.33, { rx: -Math.PI / 2 - 0.3, sx: 0.06, sy: 0.18, sz: 0.06 });
  eyes(runner, 0.07, 0.25, 0.2, 0.055);

  // tank: armoured beetle with a horn
  const beetle = new GeoBuilder()
    .add(box, '#4a3a6e', 0, 0.2, 0, { sx: 0.5, sy: 0.24, sz: 0.58 })
    .add(new DodecahedronGeometry(1, 0), enemyColors.tank, 0, 0.36, -0.03, { sx: 0.36, sy: 0.22, sz: 0.4 })
    .add(box, '#5b3fa0', 0, 0.42, -0.03, { sx: 0.06, sy: 0.18, sz: 0.62 })
    .add(cone, palette.stone, 0, 0.32, 0.38, { rx: Math.PI / 2 - 0.5, sx: 0.07, sy: 0.22, sz: 0.07 })
    .add(box, '#ffd84a', 0.12, 0.25, 0.3, { sx: 0.07, sy: 0.05, sz: 0.02 })
    .add(box, '#ffd84a', -0.12, 0.25, 0.3, { sx: 0.07, sy: 0.05, sz: 0.02 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beetle.add(box, '#3a2d58', sx * 0.25, 0.07, sz * 0.2, { sx: 0.1, sy: 0.14, sz: 0.1 });

  return { basic: slime.build(), fast: runner.build(), tank: beetle.build() };
}

const FLASH_TIME = 0.09;
const SPAWN_TIME = 0.3;

/**
 * All enemies of one type share one InstancedMesh: 3 draw calls total no matter
 * how many are alive. Per-slot state (yaw, age, hit flash) lives in typed arrays.
 */
export class EnemyView {
  private readonly meshes: Record<EnemyType, InstancedMesh>;
  private readonly yaw: Float32Array;
  private readonly age: Float32Array;
  private readonly flash: Float32Array;
  private readonly dummy = new Object3D();
  private readonly white = new Color(1, 1, 1);
  private readonly hot = new Color(3, 2.6, 2.4);
  private readonly icy = new Color(0.55, 0.85, 1.45);

  constructor(parent: Object3D, private game: Game) {
    const n = game.enemies.capacity; // the pool never grows past this
    this.yaw = new Float32Array(n);
    this.age = new Float32Array(n);
    this.flash = new Float32Array(n);
    const geos = buildModels();
    const make = (type: EnemyType) => {
      const m = new InstancedMesh(geos[type], vcMaterial, n);
      m.count = 0;
      m.frustumCulled = false; // instances move every frame; the base bounds would be wrong
      m.castShadow = true; // only rendered into the shadow map when shadows are on
      for (let i = 0; i < n; i++) m.setColorAt(i, this.white);
      parent.add(m);
      return m;
    };
    this.meshes = { basic: make('basic'), fast: make('fast'), tank: make('tank') };

    const items = game.enemies.items;
    game.events.on('enemySpawned', (e) => {
      const i = items.indexOf(e);
      this.yaw[i] = Math.atan2(e.dir.x, e.dir.z);
      this.age[i] = 0;
      this.flash[i] = 0;
    });
    game.events.on('projectileHit', (p) => {
      if (p.target) this.flash[items.indexOf(p.target)] = FLASH_TIME;
    });
  }

  /** dt is simulated seconds this frame (0 while paused). */
  sync(dt: number): void {
    const { basic, fast, tank } = this.meshes;
    basic.count = fast.count = tank.count = 0;
    const time = this.game.state.time;
    const items = this.game.enemies.items;
    const d = this.dummy;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const mesh = this.meshes[e.type];
      const mo = enemyMotion[e.type];
      const idx = mesh.count++;

      this.age[i] += dt;
      this.flash[i] = Math.max(0, this.flash[i] - dt);
      // Turn smoothly at path corners.
      let diff = Math.atan2(e.dir.x, e.dir.z) - this.yaw[i];
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw[i] += diff * Math.min(1, dt * 14);

      const phase = time * mo.freq * Math.PI * 2 + e.id * 1.3;
      const hop = Math.abs(Math.sin(phase));
      const t = Math.min(1, this.age[i] / SPAWN_TIME);
      const grow = 1 + 1.7 * (t - 1) ** 3 + 0.7 * (t - 1) ** 2; // back-out ease
      const sy = (1 + (hop - 0.5) * mo.squash * 2) * grow;
      const sxz = grow / Math.sqrt(Math.max(0.2, sy / Math.max(grow, 0.01)));

      d.position.set(e.pos.x, PATH_Y + hop * mo.hop, e.pos.z);
      d.rotation.set(0, this.yaw[i], Math.sin(phase) * mo.waddle);
      d.scale.set(sxz, sy, sxz);
      d.updateMatrix();
      mesh.setMatrixAt(idx, d.matrix);
      mesh.setColorAt(idx, this.flash[i] > 0 ? this.hot : e.slowTime > 0 ? this.icy : this.white);
    }
    markDirty(basic);
    markDirty(fast);
    markDirty(tank);
  }
}

function markDirty(m: InstancedMesh): void {
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
}
