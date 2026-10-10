import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  type Object3D,
} from 'three';
import gsap from 'gsap';
import type { Game } from '../game/Game';
import { towerStats } from '../game/towers';
import { balance } from '../config/balance';
import type { Tower, TowerType, Vec2 } from '../game/types';
import type { Assets } from './assets';
import type { Effects } from './Effects';
import type { TowerModel, TowerModels } from './towerModels';

interface TowerObj {
  tower: Tower;
  model: TowerModel;
  root: Group;
  body: Mesh;
  pivot: Group;
  head: Mesh;
  yaw: number;
  kick: number;
  /** Set by the projectileFired event; consumed in sync(). */
  fired: boolean;
}

/** Kenney tower stacks (2 draw calls each), weapon aim + recoil, upgrade/sell animation, range ring, placement ghost. */
export class TowerView {
  private readonly objs: TowerObj[] = [];
  private readonly byTower = new Map<Tower, TowerObj>();
  private readonly ring = new Group();
  private readonly ringDisc: Mesh<CircleGeometry, MeshBasicMaterial>;
  private readonly ringEdge: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly ghost = new Group();
  private readonly ghostBody: Mesh;
  private readonly ghostHead: Mesh;
  private readonly ghostMat = new MeshLambertMaterial({ color: '#9dff8a', transparent: true, opacity: 0.55, depthWrite: false });
  private ghostType: TowerType | null = null;
  private ringKey = '';
  private selected: Tower | null = null;
  private ringTime = 0;

  constructor(
    private parent: Object3D,
    game: Game,
    private effects: Effects,
    private models: TowerModels,
    private assets: Assets,
  ) {
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

    this.ghostBody = new Mesh(undefined, this.ghostMat);
    this.ghostHead = new Mesh(undefined, this.ghostMat);
    this.ghostHead.rotation.y = 0.5;
    this.ghost.add(this.ghostBody, this.ghostHead);
    this.ghost.visible = false;
    parent.add(this.ghost);

    game.events.on('towerPlaced', (t) => this.add(t));
    game.events.on('projectileFired', (p) => {
      const o = p.source && this.byTower.get(p.source);
      if (o) o.fired = true;
    });
    game.events.on('towerUpgraded', (t) => this.upgrade(t));
    game.events.on('towerSold', ({ tower, refund }) => this.remove(tower, refund));
    game.events.on('reset', () => this.clear());
  }

  select(tower: Tower | null): void {
    this.selected = tower;
    if (tower) {
      this.ghost.visible = false;
      this.showRing(tower.pos, towerStats(tower).range, '#ffffff');
    } else {
      this.ring.visible = false;
    }
  }

  get selection(): Tower | null {
    return this.selected;
  }

  /** Translucent tower + range preview on a hovered tile while in build mode. */
  showGhost(pos: Vec2 | null, ok: boolean, type: TowerType | null = null): void {
    if (!pos || !type) {
      this.ghost.visible = false;
      if (!this.selected) this.ring.visible = false;
      return;
    }
    if (type !== this.ghostType) {
      const model = this.models.get(type, 1);
      this.ghostBody.geometry = model.body;
      this.ghostHead.geometry = model.head;
      this.ghostHead.position.y = model.headY;
      this.ghostType = type;
    }
    const color = ok ? '#9dff8a' : '#ff6a5a';
    // Re-pop the ring only when what it shows changes (tile, type or validity).
    const key = `${pos.x},${pos.z},${type},${color}`;
    const changed = !this.ghost.visible || key !== this.ringKey;
    this.ghost.position.set(pos.x, 0, pos.z);
    this.ghost.visible = true;
    this.ghostMat.color.set(color);
    if (changed) {
      this.ringKey = key;
      this.showRing(pos, balance.towers[type].levels[0].range, color);
    }
  }

  /** Height a projectile leaves this tower from. */
  launchY(tower: Tower | null): number {
    const o = tower && this.byTower.get(tower);
    return o ? o.model.headY + o.model.muzzleY : 0.6;
  }

  /** dt: simulated seconds (0 while paused); realDt drives UI-ish animation. */
  sync(dt: number, realDt: number): void {
    for (let i = 0; i < this.objs.length; i++) {
      const o = this.objs[i];
      const tower = o.tower;
      const m = o.model;
      const fired = o.fired;
      o.fired = false;
      if (m.aims) {
        if (fired) {
          o.kick = 1;
          o.yaw = tower.aim; // snap so the flash lines up with the shot
          const sx = Math.sin(o.yaw);
          const cz = Math.cos(o.yaw);
          const y = m.headY + m.muzzleY;
          this.effects.muzzle(tower.pos.x + sx * m.muzzleZ, y, tower.pos.z + cz * m.muzzleZ, sx, cz, tower.type === 'cannon');
        }
        let diff = tower.aim - o.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        o.yaw += diff * Math.min(1, dt * 12);
        o.pivot.rotation.y = o.yaw;
        o.kick = Math.max(0, o.kick - dt * 7);
        const k = o.kick * o.kick;
        o.head.position.z = -0.08 * k;
        o.head.scale.set(1 + 0.06 * k, 1 - 0.08 * k, 1 + 0.06 * k);
      } else {
        // Crystal crown: idles with a slow spin, pulses when it fires.
        if (fired) {
          o.kick = 1;
          this.effects.frostPulse(tower.pos.x, m.headY + m.muzzleY, tower.pos.z);
        }
        o.kick = Math.max(0, o.kick - dt * 5);
        o.pivot.rotation.y += dt * (0.6 + o.kick * 6);
        const s = 1 + 0.15 * o.kick * o.kick;
        o.head.scale.set(s, s, s);
      }
    }
    if (this.ring.visible) {
      this.ringTime += realDt;
      this.ringEdge.material.opacity = 0.65 + Math.sin(this.ringTime * 4) * 0.2;
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
    const model = this.models.get(tower.type, tower.level);
    const a = this.assets;
    const material = model.palette === 'alt' ? a.altMaterial : model.palette === 'frost' ? a.frostMaterial : a.material;
    const root = new Group();
    const body = new Mesh(model.body, material);
    const pivot = new Group();
    pivot.position.y = model.headY;
    const head = new Mesh(model.head, material);
    pivot.add(head);
    root.add(body, pivot);
    body.castShadow = head.castShadow = true;
    body.receiveShadow = true;
    root.position.set(tower.pos.x, 0, tower.pos.z);
    this.parent.add(root);
    const obj: TowerObj = { tower, model, root, body, pivot, head, yaw: tower.aim, kick: 0, fired: false };
    this.objs.push(obj);
    this.byTower.set(tower, obj);
    // Drop in with a squash.
    gsap.fromTo(root.position, { y: 1.2 }, { y: 0, duration: 0.28, ease: 'power2.in', onComplete: () => this.effects.dust(tower.pos.x, tower.pos.z) });
    gsap.fromTo(root.scale, { x: 0.7, y: 1.3, z: 0.7 }, { x: 1, y: 1, z: 1, duration: 0.5, delay: 0.26, ease: 'elastic.out(1.2, 0.4)' });
  }

  private upgrade(tower: Tower): void {
    const o = this.byTower.get(tower);
    if (!o) return;
    o.model = this.models.get(tower.type, tower.level);
    o.body.geometry = o.model.body;
    o.pivot.position.y = o.model.headY;
    gsap.killTweensOf(o.root.scale);
    gsap.fromTo(o.root.scale, { x: 1.25, y: 0.75, z: 1.25 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.35)' });
    this.effects.upgrade(tower.pos.x, tower.pos.z, o.model.headY);
    if (this.selected === tower) this.showRing(tower.pos, towerStats(tower).range, '#ffffff');
  }

  private remove(tower: Tower, refund: number): void {
    const i = this.objs.findIndex((x) => x.tower === tower);
    if (i < 0) return;
    const o = this.objs[i];
    this.objs.splice(i, 1);
    this.byTower.delete(tower);
    if (this.selected === tower) this.select(null);
    this.effects.dust(tower.pos.x, tower.pos.z);
    this.effects.popup(`+${refund}`, tower.pos.x, o.model.headY + 0.3, tower.pos.z);
    gsap.killTweensOf(o.root.scale);
    gsap.killTweensOf(o.root.position);
    gsap.to(o.root.scale, {
      x: 0.01,
      y: 0.01,
      z: 0.01,
      duration: 0.25,
      ease: 'back.in(2)',
      onComplete: () => {
        this.parent.remove(o.root);
      },
    });
  }

  private clear(): void {
    for (const { root } of this.objs) {
      gsap.killTweensOf(root.scale);
      gsap.killTweensOf(root.position);
      this.parent.remove(root);
    }
    this.objs.length = 0;
    this.byTower.clear();
    this.select(null);
    this.ghost.visible = false;
  }
}
