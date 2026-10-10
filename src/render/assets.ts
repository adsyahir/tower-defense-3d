import {
  BufferGeometry,
  Cache,
  CanvasTexture,
  LoadingManager,
  Matrix4,
  MeshLambertMaterial,
  NearestFilter,
  SRGBColorSpace,
  TextureLoader,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';


/** Kenney Tower Defense Kit pieces we use (CC0, see public/models/LICENSE-kenney.txt). */
export const MODEL_NAMES = [
  'tower-square-bottom-a',
  'tower-square-middle-a',
  'tower-square-top-a',
  'tower-round-bottom-a',
  'tower-round-middle-a',
  'tower-round-top-a',
  'tower-round-bottom-b',
  'tower-round-crystals',
  'weapon-ballista',
  'weapon-cannon',
] as const;
export type ModelName = (typeof MODEL_NAMES)[number];

export interface Assets {
  /** One merged geometry per model (position/normal/uv), in model space, feet at y = 0. */
  geometries: Record<ModelName, BufferGeometry>;
  /** Shared material using Kenney's palette texture. */
  material: MeshLambertMaterial;
  /** Same models with Kenney's alternate palette (purple accents become blue). */
  altMaterial: MeshLambertMaterial;
  /** Default palette with every warm/purple accent shifted to icy blue. */
  frostMaterial: MeshLambertMaterial;
}

const base = `${import.meta.env.BASE_URL}models/`;

/** Merges every mesh of a loaded scene into one geometry (one draw call, one shared material). */
function mergeScene(root: Object3D): BufferGeometry {
  root.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  const m = new Matrix4();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    g.applyMatrix4(m.copy(mesh.matrixWorld));
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Could not merge model');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Recolours Kenney's palette texture: saturated red/orange/purple swatches become icy blue
 * (lightness kept), greys are untouched. One-time canvas pass at load.
 */
function frostTexture(source: Texture): Texture {
  const img = source.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255;
    const g = px[i + 1] / 255;
    const b = px[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.3) continue; // stone greys stay
    const light = (max + min) / 2;
    // Ice: hue ~195deg. Mix toward white for lighter swatches so crystals glow pale.
    const l = Math.min(0.92, 0.35 + light * 0.75);
    px[i] = Math.round(255 * l * 0.62);
    px[i + 1] = Math.round(255 * Math.min(1, l * 0.95));
    px[i + 2] = Math.round(255 * Math.min(1, l * 1.12));
  }
  ctx.putImageData(data, 0, 0);
  return new CanvasTexture(canvas);
}

function paletteMaterial(map: Texture): MeshLambertMaterial {
  map.colorSpace = SRGBColorSpace;
  // Kenney's colormap is a grid of flat swatches; nearest filtering keeps them crisp.
  map.magFilter = NearestFilter;
  map.flipY = false; // glTF UV convention
  return new MeshLambertMaterial({ map });
}

/** Loads all tower models and both palette textures. Calls onProgress with 0..1. */
export async function loadAssets(onProgress: (fraction: number) => void): Promise<Assets> {
  // Kenney GLBs all reference the same external Textures/colormap.png; cache it while loading
  // instead of fetching it per model, then release the cached files.
  Cache.enabled = true;
  try {
    return await load(onProgress);
  } finally {
    Cache.clear();
    Cache.enabled = false;
  }
}

async function load(onProgress: (fraction: number) => void): Promise<Assets> {
  const manager = new LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress(total ? loaded / total : 0);
  const gltf = new GLTFLoader(manager);
  const tex = new TextureLoader(manager);

  const [map, altMap, ...scenes] = await Promise.all([
    tex.loadAsync(`${base}Textures/colormap.png`),
    tex.loadAsync(`${base}Textures/variation-a.png`),
    ...MODEL_NAMES.map((name) => gltf.loadAsync(`${base}${name}.glb`).then((g) => g.scene)),
  ]);

  const geometries = {} as Record<ModelName, BufferGeometry>;
  MODEL_NAMES.forEach((name, i) => {
    geometries[name] = mergeScene(scenes[i]);
    // The GLB's own materials/textures are no longer needed.
    scenes[i].traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) mat.dispose();
      }
    });
  });
  return {
    geometries,
    material: paletteMaterial(map),
    altMaterial: paletteMaterial(altMap),
    frostMaterial: paletteMaterial(frostTexture(map)),
  };
}
