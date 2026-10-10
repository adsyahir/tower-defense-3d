import type { Graphics } from './storage';

export const isTouch = matchMedia('(pointer: coarse)').matches;
const dpr = window.devicePixelRatio || 1;

/** Rendering quality. Mutable so the Graphics setting and the debug GUI can change it. */
export const quality = {
  pixelRatio: Math.min(dpr, 2),
  shadows: !isTouch,
  antialias: dpr < 2,
};

/** Quality for a Graphics setting. Auto: full resolution (cap 2), shadows only on desktop. */
export function qualityFor(g: Graphics): { pixelRatio: number; shadows: boolean } {
  if (g === 'low') return { pixelRatio: Math.min(dpr, 1), shadows: false };
  if (g === 'high') return { pixelRatio: Math.min(dpr, 2), shadows: true };
  return { pixelRatio: Math.min(dpr, 2), shadows: !isTouch };
}

export const portraitQuery = matchMedia('(orientation: portrait)');

/** True if the browser can create a WebGL context. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
