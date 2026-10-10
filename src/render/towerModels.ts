import { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TowerType } from '../game/types';
import type { Assets, ModelName } from './assets';

/** Kenney pieces are ~1.1 wide; scale so a tower fits its tile with a little margin. */
export const TOWER_SCALE = 0.72;

interface Recipe {
  bottom: ModelName;
  middle: ModelName;
  /** Cap under the head, if any. */
  top: ModelName | null;
  /** Rotating weapon on top (aims at targets), or a decorative crown that just spins. */
  head: ModelName;
  aims: boolean;
  /** Muzzle position in head space (unscaled model units, facing +z). */
  muzzle: { y: number; z: number };
  palette: Palette;
}

export type Palette = 'default' | 'alt' | 'frost';

const recipes: Record<TowerType, Recipe> = {
  arrow: {
    bottom: 'tower-square-bottom-a',
    middle: 'tower-square-middle-a',
    top: 'tower-square-top-a',
    head: 'weapon-ballista',
    aims: true,
    muzzle: { y: 0.41, z: 0.45 },
    palette: 'alt',
  },
  cannon: {
    bottom: 'tower-round-bottom-a',
    middle: 'tower-round-middle-a',
    top: 'tower-round-top-a',
    head: 'weapon-cannon',
    aims: true,
    muzzle: { y: 0.38, z: 0.4 },
    palette: 'default',
  },
  frost: {
    bottom: 'tower-round-bottom-b',
    middle: 'tower-round-middle-a',
    top: null, // the crystal crown has its own base
    head: 'tower-round-crystals',
    aims: false,
    muzzle: { y: 0.6, z: 0 },
    palette: 'frost',
  },
};

export interface TowerModel {
  /** Static stacked body, scaled, feet at y = 0. */
  body: BufferGeometry;
  /** Head geometry, scaled, pivot at its base. */
  head: BufferGeometry;
  /** Height where the head sits. */
  headY: number;
  aims: boolean;
  /** Muzzle in head space (scaled). */
  muzzleY: number;
  muzzleZ: number;
  palette: Palette;
}

/** Builds and caches one model per tower type and level. Level n stacks n - 1 middle sections. */
export class TowerModels {
  private readonly cache = new Map<string, TowerModel>();
  private readonly heads = new Map<ModelName, BufferGeometry>();

  constructor(private assets: Assets) {}

  get(type: TowerType, level: number): TowerModel {
    const key = `${type}:${level}`;
    let model = this.cache.get(key);
    if (!model) {
      model = this.build(type, level);
      this.cache.set(key, model);
    }
    return model;
  }

  private build(type: TowerType, level: number): TowerModel {
    const r = recipes[type];
    const g = this.assets.geometries;
    const parts: BufferGeometry[] = [];
    let y = 0;
    const stack = (name: ModelName) => {
      const piece = g[name].clone().translate(0, y, 0);
      parts.push(piece);
      y += g[name].boundingBox!.max.y;
    };
    stack(r.bottom);
    for (let i = 1; i < level; i++) stack(r.middle);
    if (r.top) stack(r.top);
    const body = mergeGeometries(parts)!;
    body.scale(TOWER_SCALE, TOWER_SCALE, TOWER_SCALE);
    body.computeBoundingSphere();
    for (const p of parts) p.dispose();

    let head = this.heads.get(r.head);
    if (!head) {
      head = g[r.head].clone().scale(TOWER_SCALE, TOWER_SCALE, TOWER_SCALE);
      head.computeBoundingSphere();
      this.heads.set(r.head, head);
    }
    return {
      body,
      head,
      headY: y * TOWER_SCALE,
      aims: r.aims,
      muzzleY: r.muzzle.y * TOWER_SCALE,
      muzzleZ: r.muzzle.z * TOWER_SCALE,
      palette: r.palette,
    };
  }
}
