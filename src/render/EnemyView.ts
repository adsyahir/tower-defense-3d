import {
  BoxGeometry,
  ConeGeometry,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { Enemy, EnemyType } from '../game/types';
import { MeshPool } from './MeshPool';

interface Look {
  geometry: BufferGeometry;
  material: MeshLambertMaterial;
  y: number;
}

/** One shared geometry + material per enemy type. Slots swap them when an item's type changes. */
const looks: Record<EnemyType, Look> = {
  basic: { geometry: new SphereGeometry(0.25, 16, 12), material: new MeshLambertMaterial({ color: '#e05a4f' }), y: 0.25 },
  fast: {
    geometry: new ConeGeometry(0.2, 0.5, 12).rotateX(Math.PI / 2),
    material: new MeshLambertMaterial({ color: '#f2c94c' }),
    y: 0.22,
  },
  tank: { geometry: new BoxGeometry(0.5, 0.45, 0.5), material: new MeshLambertMaterial({ color: '#7b4fa8' }), y: 0.23 },
};

export class EnemyView {
  private readonly pool: MeshPool<Enemy, Mesh>;

  constructor(parent: Object3D, enemies: Enemy[]) {
    this.pool = new MeshPool(parent, enemies, () => new Mesh(), (mesh, e) => {
      const look = looks[e.type];
      mesh.geometry = look.geometry;
      mesh.material = look.material;
      mesh.position.set(e.pos.x, look.y, e.pos.z);
      mesh.rotation.y = Math.atan2(e.dir.x, e.dir.z);
    });
  }

  sync(): void {
    this.pool.sync();
  }
}
