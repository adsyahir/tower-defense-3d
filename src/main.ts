import './style.css';
import { Clock } from 'three';
import { registerSW } from 'virtual:pwa-register';
import { map01 } from './config/map01';
import { balance } from './config/balance';
import { createFpsCounter } from './debug/fps';
import { Game } from './game/Game';
import type { Tile, TowerType } from './game/types';
import { Picker } from './input/Picker';
import { portraitQuery } from './platform/device';
import { CameraRig } from './render/CameraRig';
import { EnemyView } from './render/EnemyView';
import { HealthBars } from './render/HealthBars';
import { MapView } from './render/MapView';
import { ProjectileView } from './render/ProjectileView';
import { Renderer3D } from './render/Renderer3D';
import { TowerView } from './render/TowerView';
import { Hud } from './ui/Hud';
import { setupEndOverlay } from './ui/overlays';

registerSW({ immediate: true });
// iOS Safari ignores user-scalable=no for pinch; block its gesture events.
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---- setup ----
const game = new Game(map01);
const r3d = new Renderer3D(document.querySelector<HTMLElement>('#scene')!, map01);
const rig = new CameraRig(r3d.canvas, map01);
r3d.onResize((w, h) => rig.resize(w, h));

const scene = r3d.scene;
const mapView = new MapView(game.grid, game.path);
scene.add(mapView.group);
const enemyView = new EnemyView(scene, game.enemies.items);
const healthBars = new HealthBars(scene, game.enemies.items, rig.camera);
const projectileView = new ProjectileView(scene, game.projectiles.items);
const towerView = new TowerView(scene, game);
const picker = new Picker(r3d.canvas, rig.camera, game.grid);

// ---- interaction: build mode & selection ----
let buildType: TowerType | null = null;
let speed = 1;

function setBuildType(type: TowerType | null): void {
  buildType = type;
  hud.setBuildType(type);
  if (type) towerView.select(null);
  else mapView.hideHighlight();
}

const hud = new Hud(game, {
  onTowerButton: (type) => setBuildType(buildType === type ? null : type),
  onStartWave: () => game.startWave(),
  onSpeed: () => {
    speed = speed === 1 ? 2 : 1;
    hud.setSpeed(speed);
  },
});

picker.onTap = (tile: Tile | null) => {
  if (!tile) {
    towerView.select(null);
    mapView.hideHighlight();
    return;
  }
  const tower = game.towerAt(tile);
  if (tower) {
    setBuildType(null);
    towerView.select(towerView.selection === tower ? null : tower);
    return;
  }
  towerView.select(null);
  if (buildType) {
    const result = game.placeTower(buildType, tile);
    mapView.flash(tile, result === 'ok');
    // Leave build mode once the next tower is unaffordable.
    if (result === 'ok' && game.state.gold < balance.towers[buildType].cost) setBuildType(null);
  } else {
    mapView.flash(tile, game.canPlace(tile));
  }
};

picker.onHover = (tile) => {
  if (!buildType) return;
  if (tile && !game.towerAt(tile)) mapView.showHighlight(tile, game.canPlace(tile));
  else mapView.hideHighlight();
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    setBuildType(null);
    towerView.select(null);
  }
});

game.events.on('phaseChanged', (phase) => {
  if (phase === 'gameover' || phase === 'victory') setBuildType(null);
});

setupEndOverlay(game, () => {
  game.reset();
  setBuildType(null);
});

// ---- pause: hidden tab or portrait ----
let paused = false;
const updatePaused = () => (paused = document.hidden || portraitQuery.matches);
document.addEventListener('visibilitychange', updatePaused);
portraitQuery.addEventListener('change', updatePaused);
updatePaused();

// ---- debug ----
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  import('./debug/gui').then(({ createDebugGui }) => createDebugGui({ game, r3d, hud }));
}
if (import.meta.env.DEV) Object.assign(window, { game }); // console access while developing
const fpsTick = createFpsCounter();

// ---- main loop ----
const clock = new Clock();
const MAX_STEP = 1 / 30;
r3d.renderer.setAnimationLoop(() => {
  let dt = Math.min(clock.getDelta(), 0.1); // clamp hitches and tab switches
  if (!paused) {
    dt *= speed;
    // Sub-step so fast projectiles don't tunnel at low FPS.
    while (dt > 1e-6) {
      const step = Math.min(dt, MAX_STEP);
      game.update(step);
      dt -= step;
    }
  }
  enemyView.sync();
  healthBars.sync();
  projectileView.sync();
  towerView.sync();
  rig.update();
  r3d.render(rig.camera);
  fpsTick?.();
});
