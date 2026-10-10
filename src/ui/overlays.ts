import { balance } from '../config/balance';
import type { Game } from '../game/Game';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

/** Restarts a CSS animation by toggling its class. */
function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * Event-driven overlays: game over / victory panel, wave banner and the red
 * screen-edge flash when an enemy leaks. The rotate-device overlay is pure CSS.
 */
export function setupOverlays(game: Game, onRestart: () => void): void {
  const ev = game.events;

  // ---- end panel ----
  const overlay = $<HTMLElement>('#overlay-end');
  const title = overlay.querySelector<HTMLElement>('.title')!;
  const detail = overlay.querySelector<HTMLElement>('.detail')!;
  const endWave = $<HTMLElement>('#end-wave');
  const endLives = $<HTMLElement>('#end-lives');
  overlay.querySelector('button')!.addEventListener('click', () => {
    overlay.hidden = true;
    onRestart();
  });
  ev.on('phaseChanged', (phase) => {
    if (phase !== 'gameover' && phase !== 'victory') return;
    const win = phase === 'victory';
    overlay.classList.toggle('victory', win);
    title.textContent = win ? 'Victory!' : 'Defeated';
    detail.textContent = win ? 'The castle stands. Every wave was held back.' : 'The monsters broke through the castle gate.';
    endWave.textContent = `${game.state.wave}/${game.totalWaves}`;
    endLives.textContent = String(game.state.lives);
    // Let the last death puff play before the panel slides in.
    setTimeout(() => {
      // Skip if the game was restarted during the delay.
      if (game.state.phase === phase) overlay.hidden = false;
    }, win ? 700 : 400);
  });

  // ---- wave banner ----
  const banner = $<HTMLElement>('#banner');
  const bTitle = banner.querySelector<HTMLElement>('.banner-title')!;
  const bSub = banner.querySelector<HTMLElement>('.banner-sub')!;
  const show = (sub: string, text: string, kind: string) => {
    bSub.textContent = sub;
    bTitle.textContent = text;
    banner.dataset.kind = kind;
    replay(banner, 'show');
  };
  ev.on('waveStarted', (n) => show(n === game.totalWaves ? 'Final wave' : `${n} of ${game.totalWaves}`, `Wave ${n}`, 'start'));
  ev.on('waveCleared', (n) => {
    if (n >= game.totalWaves) return;
    show(`+${balance.waveClearBonus} gold bonus`, 'Wave cleared', 'clear');
  });
  ev.on('reset', () => banner.classList.remove('show'));

  // ---- leak flash ----
  const damage = $<HTMLElement>('#damage');
  ev.on('enemyLeaked', () => replay(damage, 'hit'));
}
