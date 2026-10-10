import { AdditiveBlending, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import type { Projectile } from '../game/types';
import { PATH_Y } from './style3d';

const FLY_Y = PATH_Y + 0.62;

/** Glowing cannonballs: a hot core plus a stretched additive glow. Two draw calls total. */
export class ProjectileView {
  private readonly core: InstancedMesh;
  private readonly glow: InstancedMesh;
  private readonly dummy = new Object3D();

  constructor(parent: Object3D, private projectiles: Projectile[]) {
    const n = projectiles.length;
    this.core = new InstancedMesh(new IcosahedronGeometry(0.075, 0), new MeshBasicMaterial({ color: '#fff4c4' }), n);
    this.glow = new InstancedMesh(
      new IcosahedronGeometry(0.15, 1),
      new MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false }),
      n,
    );
    for (const m of [this.core, this.glow]) {
      m.count = 0;
      m.frustumCulled = false;
      parent.add(m);
    }
  }

  sync(): void {
    const d = this.dummy;
    let n = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;
      d.position.set(p.pos.x, FLY_Y, p.pos.z);
      d.rotation.set(0, Math.atan2(p.lastTargetPos.x - p.pos.x, p.lastTargetPos.z - p.pos.z), 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.core.setMatrixAt(n, d.matrix);
      d.scale.set(0.8, 0.8, 1.9); // stretched along flight direction: a cheap motion trail
      d.updateMatrix();
      this.glow.setMatrixAt(n, d.matrix);
      n++;
    }
    this.core.count = this.glow.count = n;
    this.core.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
  }
}
