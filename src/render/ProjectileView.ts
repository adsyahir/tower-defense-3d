import { Mesh, MeshBasicMaterial, SphereGeometry, type Object3D } from 'three';
import type { Projectile } from '../game/types';
import { MeshPool } from './MeshPool';

const geo = new SphereGeometry(0.08, 8, 6);
const mat = new MeshBasicMaterial({ color: '#fff3a0' });

export class ProjectileView {
  private readonly pool: MeshPool<Projectile, Mesh>;

  constructor(parent: Object3D, projectiles: Projectile[]) {
    this.pool = new MeshPool(parent, projectiles, () => new Mesh(geo, mat) as Mesh, (mesh, p) => {
      mesh.position.set(p.pos.x, 0.55, p.pos.z);
    });
  }

  sync(): void {
    this.pool.sync();
  }
}
