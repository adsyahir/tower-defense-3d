import { BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type ColorRepresentation } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Art direction: warm low-poly diorama. One place for the scene palette and heights. */
export const palette = {
  skyTop: '#6fb3e6',
  skyBottom: '#f7e7c8',
  fog: '#eadcc0',
  grass: '#86c45a',
  grassAlt: '#7cbb52',
  meadow: '#6fae4c',
  gridGap: '#4f8a39',
  path: '#e7c58f',
  pathDark: '#d6ae74',
  dirt: '#a5714a',
  rock: '#806a5a',
  rockDark: '#5f4f45',
  stone: '#cfc6b6',
  stoneDark: '#8f8577',
  wood: '#8a5a3a',
  leaf: '#4f9a45',
  leafLight: '#76b84e',
  pine: '#3d7d4a',
  team: '#3f7cc9',
  teamDark: '#2c5c9a',
  metal: '#2d3138',
  brass: '#e8b544',
  roof: '#d0533f',
  portal: '#9b5cff',
  portalCore: '#e2c8ff',
} as const;

/** Top of the buildable grass and of the sunken path. Picking happens at y = 0. */
export const GROUND_Y = 0;
export const PATH_Y = -0.09;

/** Shared flat-shaded material for every vertex-coloured mesh. */
export const vcMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Deterministic RNG so the scenery is the same every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PartOpts {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

/**
 * Collects primitive parts (each with a colour and transform) and merges them
 * into ONE vertex-coloured geometry, so a whole model or the whole scenery costs one draw call.
 * Build-time only; never used per frame.
 */
export class GeoBuilder {
  private readonly parts: BufferGeometry[] = [];
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly e = new Euler();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly c = new Color();
  /** Optional parent transform applied after each part's own transform. */
  parent: Matrix4 | null = null;

  add(geo: BufferGeometry, color: ColorRepresentation, x = 0, y = 0, z = 0, o: PartOpts = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    this.e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    this.m.compose(this.p.set(x, y, z), this.q.setFromEuler(this.e), this.s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    if (this.parent) this.m.premultiply(this.parent);
    g.applyMatrix4(this.m);
    this.c.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = this.c.r;
      col[i * 3 + 1] = this.c.g;
      col[i * 3 + 2] = this.c.b;
    }
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts);
    if (!merged) throw new Error('GeoBuilder: merge failed');
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    merged.computeBoundingSphere();
    return merged;
  }
}
