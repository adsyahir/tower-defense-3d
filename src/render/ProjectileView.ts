import { AdditiveBlending, Color, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import type { Game } from '../game/Game';
import type { Tower, TowerType } from '../game/types';
import { PATH_Y } from './style3d';

/** Height projectiles end at (enemy body). */
const HIT_Y = PATH_Y + 0.35;

interface Look {
  core: Color;
  glow: Color;
  /** Core scale (x, y, z) — z is along the flight direction. */
  sx: number;
  sz: number;
  /** Parabola height added mid-flight. */
  arc: number;
}

const looks: Record<TowerType, Look> = {
  arrow: { core: new Color('#fff8e0'), glow: new Color('#ffd27a'), sx: 0.45, sz: 3.2, arc: 0.1 },
  cannon: { core: new Color('#3a3530'), glow: new Color('#ff9a3c'), sx: 1.3, sz: 1.3, arc: 0.7 },
  frost: { core: new Color('#f0fdff'), glow: new Color('#58c8ff'), sx: 1, sz: 1.6, arc: 0.15 },
};

/**
 * One core + one additive glow InstancedMesh for all projectiles (2 draw calls), tinted per tower type.
 * Projectiles leave from the tower's weapon height and descend onto the target.
 */
export class ProjectileView {
  private readonly core: InstancedMesh;
  private readonly glow: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly startY: Float32Array;
  private readonly startDist: Float32Array;

  constructor(parent: Object3D, private game: Game, launchY: (tower: Tower | null) => number) {
    const items = game.projectiles.items;
    // The pool never grows past its capacity, so buffers sized to it always fit.
    const n = game.projectiles.capacity;
    this.startY = new Float32Array(n);
    this.startDist = new Float32Array(n);
    this.core = new InstancedMesh(new IcosahedronGeometry(0.075, 0), new MeshBasicMaterial(), n);
    this.glow = new InstancedMesh(
      new IcosahedronGeometry(0.15, 1),
      new MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }),
      n,
    );
    for (const m of [this.core, this.glow]) {
      m.count = 0;
      m.frustumCulled = false;
      for (let i = 0; i < n; i++) m.setColorAt(i, looks.arrow.core);
      parent.add(m);
    }
    game.events.on('projectileFired', (p) => {
      const i = items.indexOf(p);
      this.startY[i] = launchY(p.source);
      this.startDist[i] = Math.max(0.01, Math.hypot(p.lastTargetPos.x - p.pos.x, p.lastTargetPos.z - p.pos.z));
    });
  }

  sync(): void {
    const items = this.game.projectiles.items;
    const d = this.dummy;
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      const look = looks[p.kind];
      const dx = p.lastTargetPos.x - p.pos.x;
      const dz = p.lastTargetPos.z - p.pos.z;
      // Progress 0..1 along the flight (the target may move, so clamp).
      const t = Math.min(1, Math.max(0, 1 - Math.hypot(dx, dz) / this.startDist[i]));
      const y = this.startY[i] + (HIT_Y - this.startY[i]) * t + look.arc * 4 * t * (1 - t);
      d.position.set(p.pos.x, y, p.pos.z);
      d.rotation.set(0, Math.atan2(dx, dz), 0);
      d.scale.set(look.sx, look.sx, look.sz);
      d.updateMatrix();
      this.core.setMatrixAt(n, d.matrix);
      this.core.setColorAt(n, look.core);
      d.scale.set(0.8 * look.sx, 0.8 * look.sx, 1.9 * Math.max(1, look.sz * 0.6)); // stretched: a cheap motion trail
      d.updateMatrix();
      this.glow.setMatrixAt(n, d.matrix);
      this.glow.setColorAt(n, look.glow);
      n++;
    }
    this.core.count = this.glow.count = n;
    for (const m of [this.core, this.glow]) {
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor!.needsUpdate = true;
    }
  }
}
