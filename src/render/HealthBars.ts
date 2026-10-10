import { Color, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Vector3, type Camera, type Object3D } from 'three';
import type { Enemy } from '../game/types';
import { enemyMotion } from './EnemyView';
import { PATH_Y } from './style3d';

const WIDTH = 0.6;
const bgGeo = new PlaneGeometry(WIDTH + 0.06, 0.13);
// Translated so scaling x shrinks the bar toward its left edge.
const fillGeo = new PlaneGeometry(WIDTH, 0.08).translate(WIDTH / 2, 0, 0);

const high = new Color('#6be15a');
const mid = new Color('#ffd23f');
const low = new Color('#ff5a4a');

/** Billboarded bars above damaged enemies (hidden at full HP). Two draw calls for all bars. */
export class HealthBars {
  private readonly bg: InstancedMesh;
  private readonly fill: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly pos = new Vector3();
  private readonly scale = new Vector3();
  private readonly right = new Vector3();

  constructor(parent: Object3D, private enemies: Enemy[], private camera: Camera) {
    const n = enemies.length;
    this.bg = new InstancedMesh(bgGeo, new MeshBasicMaterial({ color: '#1b1f24', transparent: true, opacity: 0.8, depthWrite: false }), n);
    this.fill = new InstancedMesh(fillGeo, new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }), n); // transparent so renderOrder puts it after the bg
    for (const mesh of [this.bg, this.fill]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      parent.add(mesh);
    }
    this.fill.renderOrder = 3;
    this.fill.setColorAt(0, high); // allocates instanceColor
  }

  sync(): void {
    const q = this.camera.quaternion;
    this.right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    let n = 0;
    const items = this.enemies;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active || e.hp >= e.maxHp) continue;
      const frac = Math.max(0.001, e.hp / e.maxHp);
      this.pos.set(e.pos.x, PATH_Y + enemyMotion[e.type].barY, e.pos.z);
      this.m.compose(this.pos, q, this.scale.set(1, 1, 1));
      this.bg.setMatrixAt(n, this.m);
      this.pos.addScaledVector(this.right, -WIDTH / 2);
      this.m.compose(this.pos, q, this.scale.set(frac, 1, 1));
      this.fill.setMatrixAt(n, this.m);
      this.fill.setColorAt(n, frac > 0.5 ? high : frac > 0.25 ? mid : low);
      n++;
    }
    this.bg.count = this.fill.count = n;
    this.bg.instanceMatrix.needsUpdate = true;
    this.fill.instanceMatrix.needsUpdate = true;
    this.fill.instanceColor!.needsUpdate = true;
  }
}
