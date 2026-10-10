import { Howl, Howler } from 'howler';
import type { Game } from '../game/Game';

const NAMES = ['arrow', 'cannon', 'frost', 'hit', 'die', 'leak', 'place', 'upgrade', 'sell', 'wave', 'clear', 'lose', 'win', 'click', 'error'] as const;
export type SoundName = (typeof NAMES)[number];

/** Minimum seconds between plays of the same sound, so 20 towers firing isn't a wall of noise. */
const THROTTLE: Partial<Record<SoundName, number>> = { arrow: 0.07, cannon: 0.12, frost: 0.1, hit: 0.06, die: 0.05 };
const VOLUME: Partial<Record<SoundName, number>> = { arrow: 0.35, cannon: 0.5, frost: 0.35, hit: 0.3, die: 0.45, click: 0.4 };
const MUTE_KEY = 'td3d.muted';

/**
 * Howler wrapper driven by game events. Howler unlocks audio on the first
 * touch/click (required on iOS), so nothing plays before the player interacts.
 */
export class Sound {
  private readonly howls = {} as Record<SoundName, Howl>;
  private readonly lastPlayed: Partial<Record<SoundName, number>> = {};
  private muted: boolean;

  constructor(game: Game) {
    const base = `${import.meta.env.BASE_URL}sounds/`;
    for (const name of NAMES) {
      this.howls[name] = new Howl({ src: [`${base}${name}.wav`], volume: VOLUME[name] ?? 0.6, preload: true });
    }
    this.muted = readMuted();
    Howler.mute(this.muted);

    const ev = game.events;
    ev.on('projectileFired', (p) => this.play(p.kind));
    ev.on('projectileHit', (p) => {
      if (p.kind !== 'cannon') this.play('hit');
    });
    ev.on('enemyKilled', () => this.play('die'));
    ev.on('enemyLeaked', () => this.play('leak'));
    ev.on('towerPlaced', () => this.play('place'));
    ev.on('towerUpgraded', () => this.play('upgrade'));
    ev.on('towerSold', () => this.play('sell'));
    ev.on('placeFailed', () => this.play('error'));
    ev.on('waveStarted', () => this.play('wave'));
    ev.on('waveCleared', (n) => {
      if (n < game.totalWaves) this.play('clear');
    });
    ev.on('phaseChanged', (phase) => {
      if (phase === 'gameover') this.play('lose');
      else if (phase === 'victory') this.play('win');
    });
  }

  play(name: SoundName): void {
    if (this.muted) return;
    const now = performance.now() / 1000;
    const gap = THROTTLE[name];
    if (gap !== undefined && now - (this.lastPlayed[name] ?? -Infinity) < gap) return;
    this.lastPlayed[name] = now;
    this.howls[name].play();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // storage unavailable (private mode): the setting just won't persist
    }
    return this.muted;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
