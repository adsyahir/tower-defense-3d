export const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

/** Restarts a CSS animation by removing and re-adding its class. */
export function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the animation starts over
  el.classList.add(cls);
}
