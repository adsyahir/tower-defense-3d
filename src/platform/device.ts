export const isTouch = matchMedia('(pointer: coarse)').matches;

/** Rendering quality. Mutable so the debug GUI can tweak it. */
export const quality = {
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  shadows: !isTouch,
  antialias: (window.devicePixelRatio || 1) < 2,
};

export const portraitQuery = matchMedia('(orientation: portrait)');
