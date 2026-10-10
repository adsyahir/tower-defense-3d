import { balance } from '../config/balance';
import type { Game } from '../game/Game';
import { buildCost, towerStats } from '../game/towers';
import type { Tower, TowerType } from '../game/types';
import { $, replay } from './dom';

export interface HudHandlers {
  onTowerButton: (type: TowerType) => void;
  onStartWave: () => void;
  onSpeed: () => void;
  onMute: () => void;
  onUpgrade: (tower: Tower) => void;
  onSell: (tower: Tower) => void;
  onClosePanel: () => void;
}

const icons: Record<TowerType, string> = { arrow: '#i-ballista', cannon: '#i-tower', frost: '#i-frost' };

/** HTML overlay: stats, build cards, selected-tower panel, wave button. DOM is touched only on change events. */
export class Hud {
  private gold = $<HTMLElement>('#gold');
  private lives = $<HTMLElement>('#lives');
  private wave = $<HTMLElement>('#wave');
  private waveBtn = $<HTMLButtonElement>('#btn-wave');
  private waveLabel = $<HTMLElement>('#btn-wave .wave-label');
  private speedBtn = $<HTMLButtonElement>('#btn-speed');
  private speedLabel = $<HTMLElement>('#speed-label');
  private muteBtn = $<HTMLButtonElement>('#btn-mute');
  private root = $<HTMLElement>('#hud');
  private towerBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.tower-btn'));

  private panel = $<HTMLElement>('#tower-panel');
  private pName = $<HTMLElement>('#tower-panel .tp-name');
  private pArt = $<HTMLElement>('#tower-panel .tower-art use');
  private pPips = Array.from(document.querySelectorAll<HTMLElement>('#tower-panel .tp-pips i'));
  private pDmg = $<HTMLElement>('#tower-panel .tp-dmg');
  private pRange = $<HTMLElement>('#tower-panel .tp-range');
  private pRate = $<HTMLElement>('#tower-panel .tp-rate');
  private pExtra = $<HTMLElement>('#tower-panel .tp-extra');
  private pUpgrade = $<HTMLButtonElement>('#tower-panel .tp-upgrade');
  private pUpgradeLabel = $<HTMLElement>('#tower-panel .tp-upgrade-label');
  private pUpgradeCost = $<HTMLElement>('#tower-panel .tp-upgrade-cost');
  private pSellValue = $<HTMLElement>('#tower-panel .tp-sell-value');
  private inspected: Tower | null = null;

  constructor(private game: Game, handlers: HudHandlers) {
    for (const btn of this.towerBtns) {
      const type = btn.dataset.tower as TowerType;
      btn.querySelector('.name')!.textContent = balance.towers[type].name;
      btn.setAttribute('aria-label', `Build ${balance.towers[type].name}`);
      btn.addEventListener('click', () => handlers.onTowerButton(type));
    }
    this.waveBtn.addEventListener('click', handlers.onStartWave);
    this.speedBtn.addEventListener('click', handlers.onSpeed);
    this.muteBtn.addEventListener('click', handlers.onMute);
    this.pUpgrade.addEventListener('click', () => this.inspected && handlers.onUpgrade(this.inspected));
    $('#tower-panel .tp-sell').addEventListener('click', () => this.inspected && handlers.onSell(this.inspected));
    $('#tower-panel .tp-close').addEventListener('click', handlers.onClosePanel);

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
    ev.on('towerUpgraded', (t) => {
      if (t === this.inspected) this.refreshPanel();
    });
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

  /** Shows the upgrade/sell panel for a tower (replaces the build cards), or hides it. */
  inspect(tower: Tower | null): void {
    this.inspected = tower;
    this.panel.hidden = tower === null;
    this.root.classList.toggle('inspecting', tower !== null);
    if (tower) this.refreshPanel();
  }

  setSpeed(speed: number): void {
    this.speedLabel.textContent = `${speed}×`;
    this.speedBtn.classList.toggle('on', speed > 1);
  }

  setMuted(muted: boolean): void {
    this.muteBtn.classList.toggle('muted', muted);
    this.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  /** Re-applies costs and affordability, e.g. after gold changes or the debug GUI edits balance. */
  refreshAffordable(): void {
    for (const btn of this.towerBtns) {
      const cost = buildCost(btn.dataset.tower as TowerType);
      btn.querySelector('.cost')!.textContent = String(cost);
      btn.classList.toggle('unaffordable', this.game.state.gold < cost);
    }
    if (this.inspected) this.refreshPanel();
  }

  private refreshPanel(): void {
    const t = this.inspected!;
    const stats = towerStats(t);
    this.pName.textContent = balance.towers[t.type].name;
    this.pArt.setAttribute('href', icons[t.type]);
    this.pPips.forEach((pip, i) => pip.classList.toggle('on', i < t.level));
    this.pDmg.textContent = String(stats.damage);
    this.pRange.textContent = stats.range.toFixed(1);
    this.pRate.textContent = `${stats.fireRate}/s`;
    this.pExtra.textContent = stats.splash
      ? `Splash ${stats.splash.toFixed(1)}`
      : stats.slow
        ? `Slow ${Math.round((1 - stats.slow) * 100)}%`
        : '';
    const cost = this.game.upgradeCost(t);
    const maxed = cost === null;
    this.pUpgrade.classList.toggle('maxed', maxed);
    this.pUpgrade.classList.toggle('unaffordable', !maxed && this.game.state.gold < cost);
    this.pUpgrade.disabled = maxed;
    this.pUpgradeLabel.textContent = maxed ? 'Max level' : 'Upgrade';
    if (!maxed) this.pUpgradeCost.textContent = String(cost);
    this.pSellValue.textContent = `+${this.game.sellValue(t)}`;
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
        : s.phase === 'victory'
          ? 'Victory!'
          : 'Game over';
  }

  /** Brief red pulse, e.g. on the gold pill when something is unaffordable. */
  pulse(el: HTMLElement = this.gold.parentElement!): void {
    replay(el, 'pulse');
  }
}
