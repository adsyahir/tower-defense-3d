import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  TorusGeometry,
  AdditiveBlending,
  Vector3,
} from 'three';
import gsap from 'gsap';
import type { Grid } from '../game/grid';
import type { Path } from '../game/path';
import type { Tile, Vec2 } from '../game/types';
import { GeoBuilder, GROUND_Y, palette, PATH_Y, rng, vcMaterial } from './style3d';

const TILE_DEPTH = 0.45;
/** Width (in tiles) of the decorative meadow around the playable grid. */
const RIM = 2;

/**
 * The diorama: grass tiles (buildable grid + decorative meadow), sunken path,
 * cliff base, merged scenery, spawn portal, exit castle and the tile highlight.
 * Scenery lives only on the meadow outside the grid, so it never blocks a buildable tile.
 */
export class MapView {
  readonly group = new Group();
  /** World position of the spawn portal and the castle gate (for effects). */
  readonly portalPos = new Vector3();
  readonly castlePos = new Vector3();
  private readonly highlight: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly portalSwirl: Group;
  private readonly tmp: Vec2 = { x: 0, z: 0 };

  constructor(private grid: Grid, path: Path) {
    const rand = rng(1337);
    const { cols, rows } = grid;
    const pts = path.points;
    const start = pts[0];
    const end = pts[pts.length - 1];
    const startDir = unit(pts[1].x - start.x, pts[1].z - start.z);
    const endDir = unit(end.x - pts[pts.length - 2].x, end.z - pts[pts.length - 2].z);

    // Path tiles that continue across the meadow to the portal and the castle.
    const extra = new Set<string>();
    const toCell = (x: number, z: number) => `${Math.round(x + cols / 2 - 0.5)},${Math.round(z + rows / 2 - 0.5)}`;
    for (let k = 1; k <= RIM; k++) {
      extra.add(toCell(start.x - startDir.x * k, start.z - startDir.z * k));
      extra.add(toCell(end.x + endDir.x * k, end.z + endDir.z * k));
    }

    // ---- tiles ----
    const total = (cols + RIM * 2) * (rows + RIM * 2);
    const tileGeo = new BoxGeometry(1, TILE_DEPTH, 1);
    const tileMat = new MeshLambertMaterial({ color: '#ffffff' });
    const grass = new InstancedMesh(tileGeo, tileMat, total);
    const road = new InstancedMesh(tileGeo, tileMat, total);
    grass.receiveShadow = road.receiveShadow = true;
    const m = new Matrix4();
    const scale = new Matrix4();
    const c = new Color();
    let gi = 0;
    let ri = 0;
    for (let row = -RIM; row < rows + RIM; row++) {
      for (let col = -RIM; col < cols + RIM; col++) {
        const p = grid.tileToWorld({ col, row }, this.tmp);
        const inside = grid.isInside(col, row);
        const jitter = (rand() - 0.5) * 0.06;
        if (grid.isPath(col, row) || extra.has(`${col},${row}`)) {
          m.makeTranslation(p.x, PATH_Y - TILE_DEPTH / 2, p.z);
          road.setMatrixAt(ri, m);
          c.set(rand() < 0.18 ? palette.pathDark : palette.path).offsetHSL(0, 0, jitter);
          road.setColorAt(ri++, c);
        } else if (inside) {
          // Slightly inset so thin dark seams read as a build grid.
          m.makeTranslation(p.x, GROUND_Y - TILE_DEPTH / 2, p.z).multiply(scale.makeScale(0.95, 1, 0.95));
          grass.setMatrixAt(gi, m);
          c.set((col + row) % 2 ? palette.grass : palette.grassAlt).offsetHSL(0, 0, jitter * 0.6);
          grass.setColorAt(gi++, c);
        } else {
          m.makeTranslation(p.x, GROUND_Y - 0.02 - TILE_DEPTH / 2, p.z);
          grass.setMatrixAt(gi, m);
          c.set(palette.meadow).offsetHSL(0, 0, jitter);
          grass.setColorAt(gi++, c);
        }
      }
    }
    grass.count = gi;
    road.count = ri;
    this.group.add(grass, road);

    // ---- static scenery: one merged, vertex-coloured mesh ----
    const b = new GeoBuilder();
    const W = cols + RIM * 2;
    const H = rows + RIM * 2;
    const box = new BoxGeometry(1, 1, 1);
    // Seam colour under the grid, then the cliff: soil band over a darker rock band.
    b.add(box, palette.gridGap, 0, PATH_Y - 0.06, 0, { sx: cols, sy: 0.1, sz: rows });
    b.add(box, palette.dirt, 0, -0.42, 0, { sx: W, sy: 0.5, sz: H });
    b.add(box, palette.rock, 0, -1.05, 0, { sx: W - 0.3, sy: 0.8, sz: H - 0.3 });
    b.add(box, palette.rockDark, 0, -1.6, 0, { sx: W - 0.9, sy: 0.4, sz: H - 0.9 });
    // Boulders stuck to the cliff faces.
    const boulder = new DodecahedronGeometry(0.35, 0);
    for (let i = 0; i < 26; i++) {
      const side = i % 4;
      const t = rand() - 0.5;
      const along = side < 2 ? t * (W - 1) : t * (H - 1);
      const x = side < 2 ? along : (side === 2 ? -1 : 1) * (W / 2 - 0.1);
      const z = side < 2 ? (side === 0 ? -1 : 1) * (H / 2 - 0.1) : along;
      const s = 0.6 + rand() * 0.8;
      b.add(boulder, rand() < 0.5 ? palette.rock : palette.rockDark, x, -0.7 - rand() * 0.7, z, {
        ry: rand() * 6, rx: rand() * 3, sx: s, sy: s * 0.8, sz: s,
      });
    }

    // Portal frame and castle, oriented along the path's entry/exit direction.
    this.portalPos.set(start.x - startDir.x * 1.05, PATH_Y, start.z - startDir.z * 1.05);
    this.castlePos.set(end.x + endDir.x * 1.45, PATH_Y, end.z + endDir.z * 1.45);
    b.parent = new Matrix4().makeRotationY(Math.atan2(startDir.x, startDir.z)).setPosition(this.portalPos);
    addPortalFrame(b);
    b.parent = new Matrix4().makeRotationY(Math.atan2(endDir.x, endDir.z)).setPosition(this.castlePos);
    addCastle(b);
    b.parent = null;

    // Meadow decorations. Keep the near (camera-side) edge low so nothing hides the board.
    const keepClear = (x: number, z: number) =>
      dist2(x, z, this.portalPos) < 2.6 || dist2(x, z, this.castlePos) < 3.2 || extra.has(toCell(x, z));
    const near = rows / 2;
    for (let row = -RIM; row < rows + RIM; row++) {
      for (let col = -RIM; col < cols + RIM; col++) {
        if (grid.isInside(col, row)) continue;
        const p = grid.tileToWorld({ col, row }, this.tmp);
        for (let k = 0; k < 2; k++) {
          const x = p.x + (rand() - 0.5) * 0.7;
          const z = p.z + (rand() - 0.5) * 0.7;
          if (keepClear(x, z) || rand() < (z > rows / 2 ? 0.75 : 0.3)) continue;
          const roll = rand();
          const low = z > near;
          if (!low && roll < 0.38) addPine(b, x, z, rand);
          else if (!low && roll < 0.58) addRoundTree(b, x, z, rand);
          else if (roll < 0.72) addRock(b, x, z, rand);
          else if (roll < 0.86) addBush(b, x, z, rand);
          else addFlowers(b, x, z, rand);
        }
      }
    }
    const scenery = new Mesh(b.build(), vcMaterial);
    scenery.receiveShadow = true;
    scenery.castShadow = true;
    this.group.add(scenery);

    // ---- portal swirl (animated) ----
    this.portalSwirl = new Group();
    const ring = new Mesh(new TorusGeometry(0.4, 0.06, 6, 20), new MeshBasicMaterial({ color: palette.portal }));
    const core = new Mesh(
      new CircleGeometry(0.4, 20),
      new MeshBasicMaterial({ color: palette.portal, transparent: true, opacity: 0.75, side: DoubleSide, depthWrite: false }),
    );
    const glow = new Mesh(
      new CircleGeometry(0.26, 5),
      new MeshBasicMaterial({ color: palette.portalCore, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    );
    glow.position.z = 0.01;
    core.add(glow);
    this.portalSwirl.add(ring, core);
    this.portalSwirl.position.copy(this.portalPos).setY(PATH_Y + 0.55);
    this.portalSwirl.rotation.y = Math.atan2(startDir.x, startDir.z);
    this.group.add(this.portalSwirl);

    // ---- tile highlight ----
    this.highlight = new Mesh(
      new PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.highlight.position.y = 0.012;
    this.highlight.visible = false;
    this.group.add(this.highlight);
  }

  /** Ambient animation (real time, runs while paused too). */
  update(time: number): void {
    const core = this.portalSwirl.children[1];
    core.rotation.z = time * 1.6;
    const s = 1 + Math.sin(time * 3) * 0.06;
    core.scale.set(s, s, 1);
    core.children[0].rotation.z = -time * 3.1;
  }

  showHighlight(tile: Tile, ok: boolean): void {
    const p = this.grid.tileToWorld(tile, this.tmp);
    this.highlight.position.x = p.x;
    this.highlight.position.z = p.z;
    this.highlight.material.color.set(ok ? '#9dff8a' : '#ff5a4a');
    this.highlight.material.opacity = 0.45;
    gsap.killTweensOf(this.highlight.material);
    this.highlight.visible = true;
  }

  /** Brief highlight that fades out — feedback for a placement attempt. */
  flash(tile: Tile, ok: boolean): void {
    this.showHighlight(tile, ok);
    gsap.to(this.highlight.material, {
      opacity: 0,
      duration: 0.5,
      ease: 'power1.in',
      onComplete: () => this.hideHighlight(),
    });
  }

  hideHighlight(): void {
    this.highlight.visible = false;
  }
}

// ---- scenery pieces (build time only) ----

const trunkGeo = new CylinderGeometry(0.05, 0.075, 0.3, 5);
const pineGeo = new ConeGeometry(1, 1, 6);
const blobGeo = new IcosahedronGeometry(1, 0);
const rockGeo = new DodecahedronGeometry(1, 0);
const petalGeo = new BoxGeometry(0.06, 0.06, 0.06);
const tint = new Color();

function vary(hex: string, rand: () => number, amount = 0.08): Color {
  return tint.set(hex).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * amount);
}

function addPine(b: GeoBuilder, x: number, z: number, rand: () => number): void {
  const s = 0.8 + rand() * 0.5;
  const ry = rand() * 6;
  b.add(trunkGeo, palette.wood, x, 0.15 * s, z, { sx: s, sy: s, sz: s });
  const leaf = vary(palette.pine, rand).getHex();
  b.add(pineGeo, leaf, x, 0.45 * s, z, { ry, sx: 0.36 * s, sy: 0.5 * s, sz: 0.36 * s });
  b.add(pineGeo, leaf, x, 0.72 * s, z, { ry: ry + 0.5, sx: 0.27 * s, sy: 0.42 * s, sz: 0.27 * s });
  b.add(pineGeo, leaf, x, 0.95 * s, z, { ry, sx: 0.16 * s, sy: 0.3 * s, sz: 0.16 * s });
}

function addRoundTree(b: GeoBuilder, x: number, z: number, rand: () => number): void {
  const s = 0.8 + rand() * 0.45;
  b.add(trunkGeo, palette.wood, x, 0.2 * s, z, { sx: s * 1.2, sy: s * 1.4, sz: s * 1.2 });
  b.add(blobGeo, vary(palette.leaf, rand).getHex(), x, 0.62 * s, z, { ry: rand() * 6, sx: 0.32 * s, sy: 0.3 * s, sz: 0.32 * s });
  b.add(blobGeo, vary(palette.leafLight, rand).getHex(), x + 0.1 * s, 0.8 * s, z - 0.05, { ry: rand() * 6, sx: 0.2 * s, sy: 0.2 * s, sz: 0.2 * s });
}

function addRock(b: GeoBuilder, x: number, z: number, rand: () => number): void {
  const s = 0.12 + rand() * 0.14;
  b.add(rockGeo, vary(palette.stoneDark, rand, 0.12).getHex(), x, s * 0.3, z, { ry: rand() * 6, rx: rand(), sx: s, sy: s * 0.65, sz: s * 1.1 });
  if (rand() < 0.5) b.add(rockGeo, vary(palette.stone, rand).getHex(), x + s, s * 0.2, z + s * 0.5, { ry: rand() * 6, sx: s * 0.5, sy: s * 0.4, sz: s * 0.5 });
}

function addBush(b: GeoBuilder, x: number, z: number, rand: () => number): void {
  const s = 0.14 + rand() * 0.1;
  const col = vary(palette.leafLight, rand).getHex();
  b.add(blobGeo, col, x, s * 0.6, z, { ry: rand() * 6, sx: s * 1.2, sy: s, sz: s * 1.2 });
  b.add(blobGeo, col, x + s, s * 0.45, z + s * 0.3, { ry: rand() * 6, sx: s * 0.8, sy: s * 0.7, sz: s * 0.8 });
}

const flowerColors = ['#ffffff', '#ffd84a', '#ff8fb1', '#b58cff'];
function addFlowers(b: GeoBuilder, x: number, z: number, rand: () => number): void {
  const col = flowerColors[Math.floor(rand() * flowerColors.length)];
  for (let i = 0; i < 4; i++) b.add(petalGeo, col, x + (rand() - 0.5) * 0.35, 0.04, z + (rand() - 0.5) * 0.35, { ry: rand() * 3 });
}

/** Local frame: +z is the direction enemies walk out of the portal. */
function addPortalFrame(b: GeoBuilder): void {
  const box = new BoxGeometry(1, 1, 1);
  for (const side of [-1, 1]) {
    b.add(box, palette.stoneDark, side * 0.62, 0.08, 0, { sx: 0.36, sy: 0.16, sz: 0.4 });
    b.add(box, palette.stone, side * 0.62, 0.55, 0, { sx: 0.26, sy: 0.85, sz: 0.28 });
    b.add(new DodecahedronGeometry(0.12, 0), palette.portal, side * 0.62, 1.07, 0);
  }
  b.add(box, palette.stoneDark, 0, 1.0, 0, { sx: 1.5, sy: 0.16, sz: 0.34 });
}

/** Local frame: +z points away from the board; the gate faces -z (the incoming path). */
function addCastle(b: GeoBuilder): void {
  const box = new BoxGeometry(1, 1, 1);
  const tower = new CylinderGeometry(0.24, 0.27, 1, 8);
  const roof = new ConeGeometry(0.32, 0.45, 8);
  b.add(box, palette.stone, 0, 0.42, 0.1, { sx: 1.2, sy: 0.84, sz: 0.9 });
  for (let i = 0; i < 4; i++) b.add(box, palette.stone, -0.45 + i * 0.3, 0.92, -0.3, { sx: 0.16, sy: 0.16, sz: 0.14 });
  b.add(box, '#4a3328', 0, 0.26, -0.36, { sx: 0.42, sy: 0.52, sz: 0.06 });
  b.add(new CylinderGeometry(0.21, 0.21, 0.06, 10, 1, false, 0, Math.PI), '#4a3328', 0, 0.52, -0.36, { rx: Math.PI / 2, rz: Math.PI / 2 });
  for (const side of [-1, 1]) {
    b.add(tower, palette.stone, side * 0.66, 0.6, -0.25, { sy: 1.2 });
    b.add(roof, palette.roof, side * 0.66, 1.42, -0.25);
  }
  b.add(new CylinderGeometry(0.02, 0.02, 0.6, 4), palette.metal, 0, 1.1, 0.25);
  b.add(box, palette.team, 0.17, 1.28, 0.25, { sx: 0.3, sy: 0.18, sz: 0.03 });
}

function unit(x: number, z: number): Vec2 {
  const l = Math.hypot(x, z) || 1;
  return { x: x / l, z: z / l };
}

function dist2(x: number, z: number, p: Vector3): number {
  return (x - p.x) ** 2 + (z - p.z) ** 2;
}
