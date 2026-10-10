/** Tiny FPS counter, enabled with ?fps in the URL. Updates the DOM twice a second. */
export function createFpsCounter(): (() => void) | null {
  if (!new URLSearchParams(location.search).has('fps')) return null;
  const el = document.createElement('div');
  el.id = 'fps';
  document.body.appendChild(el);
  let frames = 0;
  let last = performance.now();
  return () => {
    frames++;
    const now = performance.now();
    if (now - last >= 500) {
      el.textContent = `${Math.round((frames * 1000) / (now - last))} fps`;
      frames = 0;
      last = now;
    }
  };
}
