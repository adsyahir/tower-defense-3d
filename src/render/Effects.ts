import {
  CanvasTexture,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Material,
  type Vector3,
} from 'three';
import type { Game } from '../game/Game';
import { enemyColors } from './EnemyView';
import { palette, PATH_Y } from './style3d';

/**
 * Fixed-capacity particle pool drawn as one InstancedMesh. Low-poly "balls"
 * that pop in and shrink away, so no transparency sorting is needed.
 * When full, the oldest particle is recycled.
 */
class Particles {
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly vz: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private readonly grav: Float32Array;
  private readonly col: Float32Array;
  private next = 0;
  readonly mesh: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly c = new Color();

  constructor(parent: Object3D, material: Material, private cap: number) {
    this.px = new Float32Array(cap);
    this.py = new Float32Array(cap);
    this.pz = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.vz = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.life = new Float32Array(cap); // 0 = dead
    this.size = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.col = new Float32Array(cap * 3);
    this.mesh = new InstancedMesh(new IcosahedronGeometry(1, 0), material, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, this.c);
    parent.add(this.mesh);
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: Color, gravity = 0): void {
    const i = this.next;
    this.next = (i + 1) % this.cap;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.grav[i] = gravity;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
  }

  /** Burst of n particles flying outward from a point. */
  burst(n: number, x: number, y: number, z: number, speed: number, up: number, life: number, size: number, color: Color, gravity = 0): void {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, life * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), color, gravity);
    }
  }

  update(dt: number): void {
    const d = this.dummy;
    const drag = Math.max(0, 1 - dt * 3);
    let n = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] === 0) continue;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.life[i] = 0;
        continue;
      }
      this.vy[i] -= this.grav[i] * dt;
      this.vx[i] *= drag;
      this.vz[i] *= drag;
      this.px[i] += this.vx[i] * dt;
      this.py[i] = Math.max(PATH_Y, this.py[i] + this.vy[i] * dt);
      this.pz[i] += this.vz[i] * dt;
      // Pop in fast, then shrink away.
      const s = this.size[i] * (t < 0.12 ? t / 0.12 : 1 - ((t - 0.12) / 0.88) ** 2);
      d.position.set(this.px[i], this.py[i], this.pz[i]);
      d.rotation.set(t * 4, i, 0);
      d.scale.set(s, s, s);
      d.updateMatrix();
      this.mesh.setMatrixAt(n, d.matrix);
      this.c.setRGB(this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]);
      this.mesh.setColorAt(n, this.c);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
}

/** Pooled floating "+5" coin labels. Textures are cached per string. */
class Popups {
  private readonly sprites: Sprite[] = [];
  private readonly age: Float32Array;
  private readonly baseY: Float32Array;
  private readonly textures = new Map<string, CanvasTexture>();
  private next = 0;
  private static readonly LIFE = 1.0;

  constructor(parent: Object3D, cap: number) {
    this.age = new Float32Array(cap).fill(Popups.LIFE);
    this.baseY = new Float32Array(cap);
    for (let i = 0; i < cap; i++) {
      const s = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
      s.visible = false;
      s.renderOrder = 10;
      this.sprites.push(s);
      parent.add(s);
    }
  }

  show(text: string, x: number, y: number, z: number): void {
    const i = this.next;
    this.next = (i + 1) % this.sprites.length;
    const s = this.sprites[i];
    s.material.map = this.texture(text);
    s.material.needsUpdate = true;
    s.position.set(x, y, z);
    s.visible = true;
    this.age[i] = 0;
    this.baseY[i] = y;
  }

  update(dt: number): void {
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i];
      if (!s.visible) continue;
      const t = (this.age[i] += dt) / Popups.LIFE;
      if (t >= 1) {
        s.visible = false;
        continue;
      }
      s.position.y = this.baseY[i] + (1 - (1 - t) ** 3) * 0.7;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.5 : 1.1 - Math.min(0.1, (t - 0.15) * 0.5);
      s.scale.set(0.8 * pop, 0.4 * pop, 1);
      s.material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    }
  }

  private texture(text: string): CanvasTexture {
    let tex = this.textures.get(text);
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    ctx.font = '700 46px Fredoka, ui-rounded, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width;
    const coinR = 15;
    const x0 = (160 - (w + coinR * 2 + 6)) / 2;
    // coin
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#5a3b08';
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath();
    ctx.arc(x0 + coinR, 40, coinR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = '#fff1a8';
    ctx.beginPath();
    ctx.arc(x0 + coinR - 4, 36, 5, 0, Math.PI * 2);
    ctx.fill();
    // text with a dark outline
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeText(text, x0 + coinR * 2 + 6, 42);
    ctx.fillStyle = '#ffe066';
    ctx.fillText(text, x0 + coinR * 2 + 6, 42);
    tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    this.textures.set(text, tex);
    return tex;
  }
}

const tmp = new Color();
const col = {
  dust: new Color('#d9c29a'),
  smoke: new Color('#e9e4da'),
  spark: new Color('#ffcf4a'),
  hot: new Color('#fff4c4'),
  portal: new Color(palette.portal),
  portalCore: new Color(palette.portalCore),
  leak: new Color('#ff5a4a'),
  ice: new Color('#9fe6ff'),
  iceCore: new Color('#ffffff'),
  boom: new Color('#ff9a3c'),
  upgrade: new Color('#ffe066'),
  enemy: {
    basic: new Color(enemyColors.basic),
    fast: new Color(enemyColors.fast),
    tank: new Color(enemyColors.tank),
  },
};

/**
 * All game-event-driven 3D juice: death puffs, hit sparks, placement dust,
 * muzzle flashes, portal bursts and floating gold. Three draw calls when busy
 * (lit particles, unlit particles, visible popups), everything pooled.
 */
export class Effects {
  private readonly puffs: Particles;
  private readonly sparks: Particles;
  private readonly popups: Popups;

  constructor(parent: Object3D, game: Game, portal: Vector3, castle: Vector3) {
    this.puffs = new Particles(parent, new MeshLambertMaterial({ flatShading: true }), 240);
    this.sparks = new Particles(parent, new MeshBasicMaterial({ toneMapped: false }), 240);
    this.popups = new Popups(parent, 16);
    const ev = game.events;

    ev.on('enemyKilled', (e) => {
      const y = PATH_Y + 0.25;
      tmp.copy(col.enemy[e.type]).lerp(col.smoke, 0.35);
      this.puffs.burst(e.type === 'tank' ? 14 : 9, e.pos.x, y, e.pos.z, 2.2, 1.6, 0.55, 0.12, tmp, 4);
      this.puffs.burst(5, e.pos.x, y, e.pos.z, 0.8, 1.2, 0.7, 0.14, col.smoke, -0.5);
      this.sparks.burst(6, e.pos.x, y + 0.1, e.pos.z, 2.8, 2.5, 0.4, 0.045, col.spark, 7);
      this.popups.show(`+${e.reward}`, e.pos.x, PATH_Y + 0.75, e.pos.z);
    });
    ev.on('projectileHit', (p) => {
      const y = PATH_Y + 0.4;
      if (p.kind === 'cannon') {
        // Explosion sized to the splash radius.
        const r = p.splash;
        this.sparks.burst(10, p.pos.x, y, p.pos.z, 3 * r, 2, 0.3, 0.06, col.boom, 5);
        this.puffs.burst(8, p.pos.x, PATH_Y + 0.15, p.pos.z, 2.2 * r, 0.8, 0.5, 0.12, col.smoke, -0.4);
      } else if (p.kind === 'frost') {
        this.sparks.burst(6, p.pos.x, y, p.pos.z, 1.6, 1.2, 0.35, 0.05, col.ice, 2);
      } else {
        this.sparks.burst(4, p.pos.x, y, p.pos.z, 2, 1.5, 0.22, 0.04, col.spark, 5);
      }
    });
    ev.on('enemyLeaked', () => {
      this.sparks.burst(12, castle.x, castle.y + 0.5, castle.z, 2, 2.5, 0.5, 0.06, col.leak, 5);
    });
    ev.on('waveStarted', () => {
      this.sparks.burst(18, portal.x, portal.y + 0.55, portal.z, 1.8, 1.4, 0.7, 0.06, col.portal, 1);
      this.sparks.burst(8, portal.x, portal.y + 0.55, portal.z, 1.0, 1.8, 0.6, 0.05, col.portalCore, 1);
    });
    ev.on('enemySpawned', (e) => {
      this.sparks.burst(4, e.pos.x, PATH_Y + 0.3, e.pos.z, 1.2, 1, 0.35, 0.04, col.portalCore, 2);
    });
  }

  /** Ring of dust where a tower lands. */
  dust(x: number, z: number): void {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const s = 1.6 + Math.random() * 0.6;
      this.puffs.emit(x + Math.cos(a) * 0.35, 0.05, z + Math.sin(a) * 0.35, Math.cos(a) * s, 0.4 + Math.random() * 0.5, Math.sin(a) * s, 0.5 + Math.random() * 0.25, 0.09 + Math.random() * 0.05, col.dust, 1);
    }
  }

  /** Flash (+ smoke when `smoky`) at a weapon tip. dirX/dirZ: unit firing direction. */
  muzzle(x: number, y: number, z: number, dirX: number, dirZ: number, smoky = true): void {
    this.sparks.emit(x, y, z, dirX * 1.5, 0, dirZ * 1.5, 0.09, smoky ? 0.13 : 0.07, col.hot);
    if (!smoky) return;
    for (let k = 0; k < 3; k++) {
      this.puffs.emit(x, y, z, dirX * (1 + Math.random()) + (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.4, dirZ * (1 + Math.random()) + (Math.random() - 0.5) * 0.6, 0.45, 0.06 + Math.random() * 0.03, col.smoke, -0.3);
    }
  }

  /** Icy burst from a frost tower's crystals. */
  frostPulse(x: number, y: number, z: number): void {
    this.sparks.burst(5, x, y, z, 1.4, 0.6, 0.35, 0.05, col.ice, -0.5);
    this.sparks.emit(x, y, z, 0, 0.3, 0, 0.12, 0.12, col.iceCore);
  }

  /** Golden sparkle column when a tower levels up. */
  upgrade(x: number, z: number, height: number): void {
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      this.sparks.emit(x + Math.cos(a) * 0.4, 0.1 + Math.random() * height, z + Math.sin(a) * 0.4, Math.cos(a) * 0.3, 1.2 + Math.random(), Math.sin(a) * 0.3, 0.6 + Math.random() * 0.3, 0.05, col.upgrade, 0.5);
    }
  }

  /** Floating coin label, e.g. a sell refund. */
  popup(text: string, x: number, y: number, z: number): void {
    this.popups.show(text, x, y, z);
  }

  /** dt: simulated seconds (0 while paused). */
  update(dt: number): void {
    this.puffs.update(dt);
    this.sparks.update(dt);
    this.popups.update(dt);
  }
}
