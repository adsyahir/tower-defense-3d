import './style.css';
import { Clock } from 'three';
import { registerSW } from 'virtual:pwa-register';
import { Sound } from './audio/Sound';
import { map01 } from './config/map01';
import { createFpsCounter } from './debug/fps';
import { Game } from './game/Game';
import { buildCost } from './game/towers';
import type { Tile, Tower, TowerType } from './game/types';
import { Picker } from './input/Picker';
import { hasWebGL, portraitQuery, quality, qualityFor } from './platform/device';
import * as storage from './platform/storage';
import { loadAssets } from './render/assets';
import { CameraRig } from './render/CameraRig';
import { Effects } from './render/Effects';
import { EnemyView } from './render/EnemyView';
import { HealthBars } from './render/HealthBars';
import { MapView } from './render/MapView';
import { ProjectileView } from './render/ProjectileView';
import { Renderer3D } from './render/Renderer3D';
import { TowerModels } from './render/towerModels';
import { TowerView } from './render/TowerView';
import { Hud } from './ui/Hud';
import { Menus } from './ui/menus';
import { setupOverlays } from './ui/overlays';

registerSW({ immediate: true });
// iOS Safari ignores user-scalable=no for pinch; block its gesture events.
document.addEventListener('gesturestart', (e) => e.preventDefault());

const loading = document.querySelector<HTMLElement>('#loading')!;
if (!hasWebGL()) {
  loading.remove();
  document.querySelector<HTMLElement>('#no-webgl')!.hidden = false;
  throw new Error('WebGL unavailable');
}

// ---- settings (applied before the renderer exists, so the first frame is right) ----
const settings = storage.loadSettings();
Object.assign(quality, qualityFor(settings.graphics));
document.body.classList.toggle('reduced-motion', settings.reducedMotion);

// ---- assets ----
const loadFill = loading.querySelector<HTMLElement>('.load-fill')!;
const assets = await loadAssets((f) => (loadFill.style.width = `${Math.round(f * 100)}%`)).catch((err: unknown) => {
  // A missing model would otherwise leave the loading bar stuck forever.
  console.error(err);
  loading.querySelector('.title')!.textContent = "Couldn't load the game";
  loading.querySelector('.load-track')!.replaceWith(
    Object.assign(document.createElement('button'), {
      className: 'btn primary',
      textContent: 'Try again',
      onclick: () => location.reload(),
    }),
  );
  throw err;
});
loading.classList.add('done');
setTimeout(() => loading.remove(), 400);

// ---- world ----
const game = new Game(map01);
const r3d = new Renderer3D(document.querySelector<HTMLElement>('#scene')!, map01);
const rig = new CameraRig(r3d.canvas, map01);
r3d.onResize((w, h) => rig.resize(w, h));

const scene = r3d.scene;
const mapView = new MapView(game.grid, game.path);
scene.add(mapView.group);
const effects = new Effects(scene, game, mapView.portalPos, mapView.castlePos);
const enemyView = new EnemyView(scene, game);
const healthBars = new HealthBars(scene, game.enemies.items, rig.camera);
const towerView = new TowerView(scene, game, effects, new TowerModels(assets), assets);
const projectileView = new ProjectileView(scene, game, (tower) => towerView.launchY(tower));
const sound = new Sound(game);
const picker = new Picker(r3d.canvas, rig.camera, game.grid);

function applySettings(): void {
  sound.setVolume(settings.volume);
  sound.setMuted(settings.muted);
  hud.setMuted(settings.muted);
  const q = qualityFor(settings.graphics);
  quality.pixelRatio = q.pixelRatio;
  quality.shadows = q.shadows;
  r3d.setPixelRatio(q.pixelRatio);
  r3d.setShadows(q.shadows);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
}

// ---- interaction: build mode & selection ----
let buildType: TowerType | null = null;
let speed = 1;

function select(tower: Tower | null): void {
  towerView.select(tower);
  hud.inspect(tower);
}

function setBuildType(type: TowerType | null): void {
  buildType = type;
  hud.setBuildType(type);
  if (type) select(null);
  else {
    mapView.hideHighlight();
    towerView.showGhost(null, false);
  }
}

function upgrade(tower: Tower): void {
  if (game.upgradeTower(tower) === 'gold') {
    sound.play('error');
    hud.pulse();
  }
}

function sell(tower: Tower): void {
  select(null);
  game.sellTower(tower);
}

function startWave(): void {
  if (game.startWave()) setBuildType(null);
}

const hud = new Hud(game, {
  onTowerButton: (type) => {
    sound.play('click');
    setBuildType(buildType === type ? null : type);
  },
  onStartWave: startWave,
  onSpeed: () => {
    sound.play('click');
    speed = speed === 1 ? 2 : 1;
    hud.setSpeed(speed);
  },
  onMute: () => {
    settings.muted = !settings.muted;
    storage.saveSettings(settings);
    applySettings();
    sound.play('click');
  },
  onPause: () => {
    sound.play('click');
    pause();
  },
  onUpgrade: upgrade,
  onSell: sell,
  onClosePanel: () => select(null),
});

picker.onTap = (tile: Tile | null) => {
  if (!tile) {
    select(null);
    mapView.hideHighlight();
    return;
  }
  const tower = game.towerAt(tile);
  if (tower) {
    setBuildType(null);
    select(towerView.selection === tower ? null : tower);
    return;
  }
  select(null);
  if (buildType) {
    const result = game.placeTower(buildType, tile);
    mapView.flash(tile, result === 'ok');
    towerView.showGhost(null, false);
    // Leave build mode once the next tower is unaffordable.
    if (result === 'ok' && game.state.gold < buildCost(buildType)) setBuildType(null);
  } else {
    mapView.flash(tile, game.canPlace(tile));
  }
};

const ghostPos = { x: 0, z: 0 };
picker.onHover = (tile) => {
  if (!buildType) return;
  if (tile && !game.towerAt(tile)) {
    const ok = game.canPlace(tile) && game.state.gold >= buildCost(buildType);
    mapView.showHighlight(tile, ok);
    towerView.showGhost(game.grid.tileToWorld(tile, ghostPos), ok, buildType);
  } else {
    mapView.hideHighlight();
    towerView.showGhost(null, false);
  }
};

// ---- menus, saving and progress ----
const progress = storage.loadProgress();

function saveRun(): void {
  const snap = game.snapshot();
  // Nothing worth continuing before the first tower or wave.
  if (snap && (snap.wave > 0 || snap.towers.length > 0)) storage.saveRun(snap);
}

function showTitle(): void {
  game.reset();
  setBuildType(null);
  select(null);
  menus.showTitle(progress, storage.loadRun(), game.totalWaves);
}

function beginPlay(): void {
  menus.closeAll();
  if (!storage.helpSeen()) menus.open('help');
}

function pause(): void {
  if (menus.isOpen || game.state.phase === 'gameover' || game.state.phase === 'victory') return;
  setBuildType(null);
  menus.open('pause');
}

const menus = new Menus(settings, {
  onContinue: () => {
    const run = storage.loadRun();
    if (!run || !game.restore(run)) {
      storage.saveRun(null);
      showTitle();
      return;
    }
    beginPlay();
  },
  onNewGame: () => {
    storage.saveRun(null);
    game.reset();
    beginPlay();
  },
  onResume: () => menus.closeAll(),
  onRestart: () => {
    storage.saveRun(null);
    game.reset();
    setBuildType(null);
    select(null);
    menus.closeAll();
  },
  onQuit: () => {
    // Mid-wave progress is dropped; the run saved before this wave stays.
    saveRun();
    showTitle();
  },
  onSettings: () => {
    storage.saveSettings(settings);
    applySettings();
  },
  onResetProgress: () => {
    storage.clearProgress();
    progress.bestWave = 0;
    progress.wins = 0;
  },
  onHelpClosed: () => storage.markHelpSeen(),
  onClick: () => sound.play('click'),
});

game.events.on('waveStarted', (n) => {
  if (n > progress.bestWave) {
    progress.bestWave = n;
    storage.saveProgress(progress);
  }
});
game.events.on('phaseChanged', (phase) => {
  if (phase === 'build') saveRun();
  if (phase === 'gameover' || phase === 'victory') {
    storage.saveRun(null);
    if (phase === 'victory') {
      progress.wins++;
      storage.saveProgress(progress);
    }
    setBuildType(null);
    select(null);
  }
});
for (const ev of ['towerPlaced', 'towerUpgraded', 'towerSold'] as const) game.events.on(ev, saveRun);

setupOverlays(game, () => {
  game.reset();
  setBuildType(null);
});

// ---- keyboard (desktop) ----
const hotkeys: Record<string, TowerType> = { '1': 'arrow', '2': 'cannon', '3': 'frost' };
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (menus.isOpen) {
    if (key === 'escape' && menus.top !== 'title') {
      if (menus.top === 'pause') menus.closeAll();
      else menus.back();
    }
    return;
  }
  const playing = game.state.phase === 'build' || game.state.phase === 'wave';
  if (!playing) return;
  if (key === 'escape') {
    // First Escape cancels build mode / selection; with nothing to cancel it pauses.
    if (buildType || towerView.selection) {
      setBuildType(null);
      select(null);
    } else pause();
  } else if (key === 'p') pause();
  else if (key === ' ') {
    e.preventDefault(); // don't also "click" a focused button
    startWave();
  } else if (hotkeys[key]) {
    setBuildType(buildType === hotkeys[key] ? null : hotkeys[key]);
  } else if (key === 'u' && towerView.selection) upgrade(towerView.selection);
  else if (key === 's' && towerView.selection) sell(towerView.selection);
});

// ---- pause: menu open, hidden tab or portrait ----
let paused = false;
const updatePaused = () => (paused = menus.isOpen || document.hidden || portraitQuery.matches);
menus.onOpenChange = updatePaused;
document.addEventListener('visibilitychange', () => {
  // Leaving the app mid-wave opens the pause menu, so coming back doesn't throw you straight in.
  if (document.hidden && game.state.phase === 'wave') pause();
  updatePaused();
});
portraitQuery.addEventListener('change', updatePaused);

applySettings();
showTitle();
updatePaused();

// ---- debug ----
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  import('./debug/gui').then(({ createDebugGui }) => createDebugGui({ game, r3d, hud }));
}
if (import.meta.env.DEV) Object.assign(window, { game, r3d, menus }); // console access while developing
const fpsTick = createFpsCounter();

// ---- main loop ----
const clock = new Clock();
const MAX_STEP = 1 / 30;
let realTime = 0;
r3d.renderer.setAnimationLoop(() => {
  const realDt = Math.min(clock.getDelta(), 0.1); // clamp hitches and tab switches
  realTime += realDt;
  // Simulated time this frame: 0 while paused or after the game ended, so effects freeze too.
  const over = game.state.phase === 'gameover' || game.state.phase === 'victory';
  const simDt = paused ? 0 : realDt * speed;
  // Sub-step so fast projectiles don't tunnel at low FPS.
  let dt = simDt;
  while (dt > 1e-6) {
    const step = Math.min(dt, MAX_STEP);
    game.update(step);
    dt -= step;
  }
  mapView.update(realTime);
  enemyView.sync(over ? 0 : simDt);
  healthBars.sync();
  projectileView.sync();
  towerView.sync(over ? 0 : simDt, realDt);
  effects.update(simDt);
  rig.update();
  r3d.render(rig.camera);
  fpsTick?.();
});
