import type { RunSave } from '../game/save';
import type { Graphics, Progress, Settings } from '../platform/storage';
import { $ } from './dom';

type ScreenId = 'title' | 'pause' | 'settings' | 'help';

export interface MenuHandlers {
  onContinue: () => void;
  onNewGame: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  /** Settings changed in the UI (already applied to the object passed in). */
  onSettings: (s: Settings) => void;
  onResetProgress: () => void;
  /** Fired when How to play is closed. */
  onHelpClosed: () => void;
  /** Any menu click, for the UI sound. */
  onClick: () => void;
}

/**
 * Title, pause, settings and help screens as a stack: settings/help open on top of
 * title or pause, and Back returns to whatever was underneath.
 */
export class Menus {
  private stack: ScreenId[] = [];
  private readonly el: Record<ScreenId, HTMLElement> = {
    title: $('#title'),
    pause: $('#pause'),
    settings: $('#settings'),
    help: $('#help'),
  };
  private resetArmed = 0;
  /** Called whenever a menu opens or the last one closes. */
  onOpenChange: (open: boolean) => void = () => {};

  constructor(private settings: Settings, private h: MenuHandlers) {
    const click = (sel: string, fn: () => void) =>
      $(sel).addEventListener('click', () => {
        h.onClick();
        fn();
      });

    click('#btn-continue', () => h.onContinue());
    click('#btn-new', () => h.onNewGame());
    click('#btn-help', () => this.open('help'));
    click('#btn-settings', () => this.open('settings'));

    const act = (screen: ScreenId, name: string, fn: () => void) =>
      this.el[screen].querySelector(`[data-act="${name}"]`)!.addEventListener('click', () => {
        h.onClick();
        fn();
      });
    act('pause', 'resume', () => h.onResume());
    act('pause', 'restart', () => h.onRestart());
    act('pause', 'quit', () => h.onQuit());
    act('pause', 'help', () => this.open('help'));
    act('pause', 'settings', () => this.open('settings'));
    act('settings', 'back', () => this.back());
    act('help', 'back', () => {
      this.back();
      h.onHelpClosed();
    });

    this.bindSettings();
  }

  get isOpen(): boolean {
    return this.stack.length > 0;
  }

  get top(): ScreenId | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Opens a screen on top of the current one. */
  open(id: ScreenId): void {
    if (this.top === id) return;
    if (this.top) this.el[this.top].hidden = true;
    this.stack.push(id);
    this.el[id].hidden = false;
    document.body.classList.toggle('on-title', this.stack.includes('title'));
    if (id === 'settings') this.syncSettings();
    if (id === 'pause') this.el.pause.querySelector<HTMLElement>('[data-act="resume"]')!.focus({ preventScroll: true });
    this.onOpenChange(true);
  }

  /** Closes the top screen, revealing the one underneath. */
  back(): void {
    const id = this.stack.pop();
    if (id) this.el[id].hidden = true;
    if (this.top) this.el[this.top].hidden = false;
    document.body.classList.toggle('on-title', this.stack.includes('title'));
    if (!this.isOpen) this.onOpenChange(false);
  }

  closeAll(): void {
    while (this.isOpen) this.back();
  }

  /** Shows the title screen, with Continue only when there is a saved run. */
  showTitle(progress: Progress, run: RunSave | null, totalWaves: number): void {
    this.closeAll();
    const cont = $<HTMLButtonElement>('#btn-continue');
    const fresh = $<HTMLButtonElement>('#btn-new');
    cont.hidden = run === null;
    fresh.classList.toggle('primary', run === null);
    if (run) $('#continue-detail').textContent = `Wave ${run.wave + 1} of ${totalWaves} · ${run.lives} lives`;
    $('#best-line').textContent =
      progress.wins > 0
        ? `Victories: ${progress.wins}`
        : progress.bestWave > 0
          ? `Best: wave ${progress.bestWave} of ${totalWaves}`
          : '';
    this.open('title');
    (run ? cont : fresh).focus({ preventScroll: true });
  }

  // ---- settings ----

  private bindSettings(): void {
    const s = this.settings;
    const changed = () => {
      this.syncSettings();
      this.h.onSettings(s);
    };
    $<HTMLInputElement>('#set-volume').addEventListener('input', (e) => {
      s.volume = Number((e.target as HTMLInputElement).value) / 100;
      changed();
    });
    $('#set-mute').addEventListener('click', () => {
      s.muted = !s.muted;
      changed();
      this.h.onClick();
    });
    for (const btn of this.el.settings.querySelectorAll<HTMLButtonElement>('#set-graphics .btn')) {
      btn.addEventListener('click', () => {
        s.graphics = btn.dataset.v as Graphics;
        changed();
        this.h.onClick();
      });
    }
    $('#set-motion').addEventListener('click', () => {
      s.reducedMotion = !s.reducedMotion;
      changed();
      this.h.onClick();
    });
    // Two taps to confirm (no browser dialogs): the first arms it for 3 seconds.
    const reset = $<HTMLButtonElement>('#set-reset');
    reset.addEventListener('click', () => {
      this.h.onClick();
      if (performance.now() < this.resetArmed) {
        this.resetArmed = 0;
        reset.classList.remove('confirm');
        reset.textContent = 'Progress reset';
        reset.disabled = true;
        this.h.onResetProgress();
        return;
      }
      this.resetArmed = performance.now() + 3000;
      reset.classList.add('confirm');
      reset.textContent = 'Tap again to reset';
      setTimeout(() => {
        if (performance.now() >= this.resetArmed) this.syncReset();
      }, 3100);
    });
  }

  private syncSettings(): void {
    const s = this.settings;
    const vol = Math.round(s.volume * 100);
    $<HTMLInputElement>('#set-volume').value = String(vol);
    $('#set-volume-out').textContent = `${vol}%`;
    const mute = $('#set-mute');
    mute.textContent = s.muted ? 'Off' : 'On';
    mute.setAttribute('aria-pressed', String(!s.muted));
    for (const btn of this.el.settings.querySelectorAll<HTMLButtonElement>('#set-graphics .btn')) {
      const on = btn.dataset.v === s.graphics;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    const motion = $('#set-motion');
    motion.textContent = s.reducedMotion ? 'On' : 'Off';
    motion.setAttribute('aria-pressed', String(s.reducedMotion));
    if (this.resetArmed === 0) this.syncReset();
  }

  private syncReset(): void {
    this.resetArmed = 0;
    const reset = $<HTMLButtonElement>('#set-reset');
    reset.classList.remove('confirm');
    reset.disabled = false;
    reset.textContent = 'Reset progress';
  }
}
