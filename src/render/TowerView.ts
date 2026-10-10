import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  type Object3D,
} from 'three';
import gsap from 'gsap';
import { balance } from '../config/balance';
import type { Game } from '../game/Game';
import type { Tower } from '../game/types';
import { quality } from '../platform/device';

const baseGeo = new CylinderGeometry(0.38, 0.42, 0.3, 16);
const turretGeo = new BoxGeometry(0.36, 0.26, 0.36);
const barrelGeo = new BoxGeometry(0.1, 0.1, 0.4);
const baseMat = new MeshLambertMaterial({ color: '#8a8f99' });
const turretMat = new MeshLambertMaterial({ color: '#3d6fb6' });
const barrelMat = new MeshLambertMaterial({ color: '#2b2f36' });

interface TowerObj {
  root: Group;
  turret: Group;
}

/** Tower meshes (created on placement), turret aim, selection range ring. */
export class TowerView {
  private readonly objs = new Map<Tower, TowerObj>();
  private readonly ring: Mesh<RingGeometry, MeshBasicMaterial>;
  private selected: Tower | null = null;

  constructor(private parent: Object3D, game: Game) {
    this.ring = new Mesh(
      new RingGeometry(0.95, 1, 48).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }),
    );
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    parent.add(this.ring);

    game.events.on('towerPlaced', (t) => this.add(t));
    game.events.on('reset', () => this.clear());
  }

  select(tower: Tower | null): void {
    this.selected = tower;
    this.ring.visible = tower !== null;
    if (tower) {
      const r = balance.towers[tower.type].range;
      this.ring.position.x = tower.pos.x;
      this.ring.position.z = tower.pos.z;
      this.ring.scale.setScalar(r);
    }
  }

  get selection(): Tower | null {
    return this.selected;
  }

  sync(): void {
    for (const [tower, obj] of this.objs) obj.turret.rotation.y = tower.aim;
    if (this.selected) this.ring.scale.setScalar(balance.towers[this.selected.type].range);
  }

  private add(tower: Tower): void {
    const root = new Group();
    const base = new Mesh(baseGeo, baseMat);
    base.position.y = 0.15;
    const turret = new Group();
    turret.position.y = 0.43;
    const head = new Mesh(turretGeo, turretMat);
    const barrel = new Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0.02, 0.3);
    turret.add(head, barrel);
    root.add(base, turret);
    if (quality.shadows) base.castShadow = head.castShadow = barrel.castShadow = true;
    root.position.set(tower.pos.x, 0, tower.pos.z);
    this.parent.add(root);
    this.objs.set(tower, { root, turret });
    gsap.from(root.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.35, ease: 'back.out(2)' });
  }

  private clear(): void {
    for (const { root } of this.objs.values()) {
      gsap.killTweensOf(root.scale);
      this.parent.remove(root);
    }
    this.objs.clear();
    this.select(null);
  }
}
