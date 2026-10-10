import type { Game } from '../game/Game';

/** Game over / victory screen. The rotate-device overlay is pure CSS (see style.css). */
export function setupEndOverlay(game: Game, onRestart: () => void): void {
  const overlay = document.querySelector<HTMLElement>('#overlay-end')!;
  const title = overlay.querySelector<HTMLElement>('.title')!;
  const detail = overlay.querySelector<HTMLElement>('.detail')!;
  overlay.querySelector('button')!.addEventListener('click', () => {
    overlay.hidden = true;
    onRestart();
  });

  game.events.on('phaseChanged', (phase) => {
    if (phase !== 'gameover' && phase !== 'victory') return;
    title.textContent = phase === 'victory' ? 'Victory!' : 'Game over';
    detail.textContent =
      phase === 'victory'
        ? `All ${game.totalWaves} waves cleared with ${game.state.lives} lives left.`
        : `You reached wave ${game.state.wave} of ${game.totalWaves}.`;
    overlay.hidden = false;
  });
}
