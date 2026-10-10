import { balance } from '../config/balance';
import type { Game } from '../game/Game';
import type { TowerType } from '../game/types';

export interface HudHandlers {
  onTowerButton: (type: TowerType) => void;
  onStartWave: () => void;
  onSpeed: () => void;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

/** HTML overlay: stats, tower buttons, wave button. DOM is touched only on change events. */
export class Hud {
  private gold = $<HTMLElement>('#gold');
  private lives = $<HTMLElement>('#lives');
  private wave = $<HTMLElement>('#wave');
  private waveBtn = $<HTMLButtonElement>('#btn-wave');
  private waveLabel = $<HTMLElement>('#btn-wave .wave-label');
  private speedBtn = $<HTMLButtonElement>('#btn-speed');
  private speedLabel = $<HTMLElement>('#speed-label');
  private root = $<HTMLElement>('#hud');
  private towerBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.tower-btn'));

  constructor(private game: Game, handlers: HudHandlers) {
    for (const btn of this.towerBtns) {
      const type = btn.dataset.tower as TowerType;
      btn.querySelector('.cost')!.textContent = String(balance.towers[type].cost);
      btn.addEventListener('click', () => handlers.onTowerButton(type));
    }
    this.waveBtn.addEventListener('click', handlers.onStartWave);
    this.speedBtn.addEventListener('click', handlers.onSpeed);

    const ev = game.events;
    ev.on('goldChanged', (g) => {
      this.gold.textContent = String(g);
      this.refreshAffordable();
    });
    ev.on('livesChanged', (l) => (this.lives.textContent = String(l)));
    ev.on('enemyLeaked', () => this.pulse(this.lives.parentElement!));
    ev.on('waveStarted', () => this.refreshWave());
    ev.on('phaseChanged', () => this.refreshWave());
    ev.on('reset', () => this.refreshWave());
    ev.on('placeFailed', ({ reason }) => {
      if (reason === 'gold') this.pulse(this.gold.parentElement!);
    });
    this.gold.textContent = String(game.state.gold);
    this.lives.textContent = String(game.state.lives);
    this.refreshWave();
    this.refreshAffordable();
  }

  setBuildType(type: TowerType | null): void {
    for (const btn of this.towerBtns) btn.classList.toggle('active', btn.dataset.tower === type);
    this.root.classList.toggle('building', type !== null);
  }

  setSpeed(speed: number): void {
    this.speedLabel.textContent = `${speed}×`;
    this.speedBtn.classList.toggle('on', speed > 1);
  }

  /** Re-applies costs, e.g. after the debug GUI edits balance. */
  refreshAffordable(): void {
    for (const btn of this.towerBtns) {
      const cost = balance.towers[btn.dataset.tower as TowerType].cost;
      btn.querySelector('.cost')!.textContent = String(cost);
      btn.classList.toggle('unaffordable', this.game.state.gold < cost);
    }
  }

  private refreshWave(): void {
    const s = this.game.state;
    this.wave.textContent = `${s.wave}/${this.game.totalWaves}`;
    const canStart = s.phase === 'build';
    this.waveBtn.disabled = !canStart;
    this.waveBtn.classList.toggle('ready', canStart);
    this.waveBtn.classList.toggle('busy', s.phase === 'wave');
    this.waveLabel.textContent = canStart
      ? s.wave === 0
        ? 'Start wave'
        : `Wave ${s.wave + 1}`
      : s.phase === 'wave'
        ? 'Fighting…'
        : 'Game over';
  }

  private pulse(el: HTMLElement): void {
    el.classList.remove('pulse');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('pulse');
  }
}
