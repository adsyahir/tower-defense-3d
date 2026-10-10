import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
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
import type { Tower, Vec2 } from '../game/types';
import { quality } from '../platform/device';
import type { Effects } from './Effects';
import { GeoBuilder, palette, vcMaterial } from './style3d';

const TURRET_Y = 0.5;
const box = new BoxGeometry(1, 1, 1);
const cyl8 = new CylinderGeometry(1, 1, 1, 8);

// Static stone base: plinth, tapered body, wooden band, rim, door.
const baseGeo = new GeoBuilder()
  .add(cyl8, palette.stoneDark, 0, 0.06, 0, { sx: 0.46, sy: 0.12, sz: 0.46 })
  .add(new CylinderGeometry(0.34, 0.4, 0.3, 8), palette.stone, 0, 0.27, 0)
  .add(cyl8, palette.wood, 0, 0.36, 0, { sx: 0.375, sy: 0.06, sz: 0.375 })
  .add(cyl8, palette.stone, 0, 0.46, 0, { sx: 0.39, sy: 0.08, sz: 0.39 })
  .add(box, '#4a3328', 0, 0.2, 0.36, { sx: 0.14, sy: 0.2, sz: 0.06 })
  .build();

// Rotating cannon head: faces +z. Pivot at its base.
const MUZZLE_Z = 0.52;
const MUZZLE_Y = 0.13;
const turretGeo = new GeoBuilder()
  .add(cyl8, palette.team, 0, 0.1, 0, { sx: 0.25, sy: 0.2, sz: 0.25 })
  .add(new ConeGeometry(0.26, 0.14, 8), palette.teamDark, 0, 0.27, 0)
  .add(new CylinderGeometry(0.055, 0.065, 0.42, 8), palette.metal, 0, MUZZLE_Y, 0.27, { rx: Math.PI / 2 })
  .add(new CylinderGeometry(0.078, 0.078, 0.07, 8), palette.brass, 0, MUZZLE_Y, 0.47, { rx: Math.PI / 2 })
  .add(box, palette.metal, 0, 0.12, -0.24, { sx: 0.16, sy: 0.12, sz: 0.1 })
  .add(box, palette.brass, 0, 0.36, 0, { sx: 0.06, sy: 0.06, sz: 0.06, ry: Math.PI / 4 })
  .build();

interface TowerObj {
  tower: Tower;
  root: Group;
  pivot: Group;
  head: Mesh;
  yaw: number;
  kick: number;
  lastCooldown: number;
}

/** Tower meshes (2 draw calls each), turret aim + recoil, range ring, placement ghost. */
export class TowerView {
  private readonly objs: TowerObj[] = [];
  private readonly ring = new Group();
  private readonly ringDisc: Mesh<CircleGeometry, MeshBasicMaterial>;
  private readonly ringEdge: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly ghost = new Group();
  private readonly ghostMat = new MeshLambertMaterial({ color: '#9dff8a', transparent: true, opacity: 0.55, depthWrite: false });
  private selected: Tower | null = null;
  private ringTime = 0;

  constructor(private parent: Object3D, game: Game, private effects: Effects) {
    this.ringDisc = new Mesh(
      new CircleGeometry(1, 48).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false }),
    );
    this.ringEdge = new Mesh(
      new RingGeometry(0.965, 1, 64).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.ringDisc.renderOrder = this.ringEdge.renderOrder = 1;
    this.ring.add(this.ringDisc, this.ringEdge);
    this.ring.position.y = 0.015;
    this.ring.visible = false;
    parent.add(this.ring);

    const gBase = new Mesh(baseGeo, this.ghostMat);
    const gHead = new Mesh(turretGeo, this.ghostMat);
    gHead.position.y = TURRET_Y;
    gHead.rotation.y = 0.5;
    this.ghost.add(gBase, gHead);
    this.ghost.visible = false;
    parent.add(this.ghost);

    game.events.on('towerPlaced', (t) => this.add(t));
    game.events.on('reset', () => this.clear());
  }

  select(tower: Tower | null): void {
    this.selected = tower;
    if (tower) {
      this.ghost.visible = false;
      this.showRing(tower.pos, balance.towers[tower.type].range, '#ffffff');
    } else {
      this.ring.visible = false;
    }
  }

  get selection(): Tower | null {
    return this.selected;
  }

  /** Translucent tower + range preview on a hovered tile while in build mode. */
  showGhost(pos: Vec2 | null, ok: boolean): void {
    if (!pos) {
      this.ghost.visible = false;
      if (!this.selected) this.ring.visible = false;
      return;
    }
    this.ghost.position.set(pos.x, 0, pos.z);
    this.ghost.visible = true;
    const color = ok ? '#9dff8a' : '#ff6a5a';
    this.ghostMat.color.set(color);
    this.showRing(pos, balance.towers.basic.range, color);
  }

  /** dt: simulated seconds (0 while paused); realDt drives UI-ish animation. */
  sync(dt: number, realDt: number): void {
    for (let i = 0; i < this.objs.length; i++) {
      const o = this.objs[i];
      const tower = o.tower;
      // Fire detection: the cooldown only jumps up when a shot is fired.
      if (tower.cooldown > o.lastCooldown + 1e-4) {
        o.kick = 1;
        o.yaw = tower.aim; // snap so the flash lines up with the shot
        const sx = Math.sin(o.yaw);
        const cz = Math.cos(o.yaw);
        this.effects.muzzle(tower.pos.x + sx * MUZZLE_Z, TURRET_Y + MUZZLE_Y, tower.pos.z + cz * MUZZLE_Z, sx, cz);
      }
      o.lastCooldown = tower.cooldown;
      let diff = tower.aim - o.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      o.yaw += diff * Math.min(1, dt * 12);
      o.pivot.rotation.y = o.yaw;
      o.kick = Math.max(0, o.kick - dt * 7);
      const k = o.kick * o.kick;
      o.head.position.z = -0.1 * k;
      o.head.scale.set(1 + 0.08 * k, 1 - 0.1 * k, 1 + 0.08 * k);
    }
    if (this.ring.visible) {
      this.ringTime += realDt;
      this.ringEdge.material.opacity = 0.65 + Math.sin(this.ringTime * 4) * 0.2;
      if (this.selected) this.ring.scale.setScalar(balance.towers[this.selected.type].range);
    }
  }

  private showRing(pos: Vec2, range: number, color: string): void {
    this.ring.position.x = pos.x;
    this.ring.position.z = pos.z;
    this.ringDisc.material.color.set(color);
    this.ringEdge.material.color.set(color);
    this.ring.visible = true;
    gsap.killTweensOf(this.ring.scale);
    gsap.fromTo(this.ring.scale, { x: range * 0.85, y: 1, z: range * 0.85 }, { x: range, z: range, duration: 0.25, ease: 'back.out(2)' });
  }

  private add(tower: Tower): void {
    const root = new Group();
    const base = new Mesh(baseGeo, vcMaterial);
    const pivot = new Group();
    pivot.position.y = TURRET_Y;
    const head = new Mesh(turretGeo, vcMaterial);
    pivot.add(head);
    root.add(base, pivot);
    if (quality.shadows) base.castShadow = head.castShadow = true;
    base.receiveShadow = true;
    root.position.set(tower.pos.x, 0, tower.pos.z);
    this.parent.add(root);
    this.objs.push({ tower, root, pivot, head, yaw: tower.aim, kick: 0, lastCooldown: tower.cooldown });
    // Drop in with a squash.
    gsap.fromTo(root.position, {
      y: 1.2,
    }, { y: 0, duration: 0.28, ease: 'power2.in', onComplete: () => this.effects.dust(tower.pos.x, tower.pos.z) });
    gsap.fromTo(root.scale, { x: 0.7, y: 1.3, z: 0.7 }, { x: 1, y: 1, z: 1, duration: 0.5, delay: 0.26, ease: 'elastic.out(1.2, 0.4)' });
  }

  private clear(): void {
    for (const { root } of this.objs) {
      gsap.killTweensOf(root.scale);
      gsap.killTweensOf(root.position);
      this.parent.remove(root);
    }
    this.objs.length = 0;
    this.select(null);
    this.ghost.visible = false;
  }
}
