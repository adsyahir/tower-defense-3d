import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Camera, type Object3D } from 'three';
import type { Enemy } from '../game/types';
import { MeshPool } from './MeshPool';

const WIDTH = 0.6;
const bgGeo = new PlaneGeometry(WIDTH + 0.04, 0.12);
// Translated so scaling x shrinks the bar toward its left edge.
const fillGeo = new PlaneGeometry(WIDTH, 0.08).translate(WIDTH / 2, 0, 0);
const bgMat = new MeshBasicMaterial({ color: '#222222' });
const fillMat = new MeshBasicMaterial({ color: '#4cd964' });

/** Billboarded bars above damaged enemies. Hidden at full HP. */
export class HealthBars {
  private readonly pool: MeshPool<Enemy, Group>;

  constructor(parent: Object3D, enemies: Enemy[], camera: Camera) {
    this.pool = new MeshPool(
      parent,
      enemies,
      () => {
        const g = new Group();
        const fill = new Mesh(fillGeo, fillMat);
        fill.position.set(-WIDTH / 2, 0, 0.001);
        g.add(new Mesh(bgGeo, bgMat), fill);
        return g;
      },
      (g, e) => {
        if (e.hp >= e.maxHp) {
          g.visible = false;
          return;
        }
        g.position.set(e.pos.x, 0.75, e.pos.z);
        g.quaternion.copy(camera.quaternion);
        g.children[1].scale.x = Math.max(0.001, e.hp / e.maxHp);
      },
    );
  }

  sync(): void {
    this.pool.sync();
  }
}
