import GUI from 'lil-gui';
import { balance } from '../config/balance';
import { damageEnemy, spawnEnemy } from '../game/enemies';
import type { Game } from '../game/Game';
import type { EnemyType } from '../game/types';
import { quality } from '../platform/device';
import type { Renderer3D } from '../render/Renderer3D';
import type { Hud } from '../ui/Hud';

/** Loaded lazily (dev or ?debug) so lil-gui stays out of the main bundle. */
export function createDebugGui({ game, r3d, hud }: { game: Game; r3d: Renderer3D; hud: Hud }): GUI {
  const gui = new GUI({ title: 'Debug' });
  gui.close();
  // Sit below the top HUD bar so it doesn't cover the speed button.
  gui.domElement.style.top = 'calc(56px + env(safe-area-inset-top))';

  const towers = gui.addFolder('Towers');
  for (const [type, stats] of Object.entries(balance.towers)) {
    const f = towers.addFolder(type);
    f.add(stats, 'cost', 0, 500, 5).onChange(() => hud.refreshAffordable());
    f.add(stats, 'range', 0.5, 8, 0.1);
    f.add(stats, 'damage', 1, 200, 1);
    f.add(stats, 'fireRate', 0.1, 10, 0.1);
    f.add(stats, 'projectileSpeed', 1, 30, 0.5);
  }

  const enemies = gui.addFolder('Enemies');
  for (const [type, stats] of Object.entries(balance.enemies)) {
    const f = enemies.addFolder(type);
    f.add(stats, 'hp', 1, 1000, 1);
    f.add(stats, 'speed', 0.1, 6, 0.1);
    f.add(stats, 'reward', 0, 100, 1);
    f.close();
  }
  enemies.close();

  const economy = gui.addFolder('Economy');
  economy.add(balance, 'startGold', 0, 1000, 10);
  economy.add(balance, 'startLives', 1, 100, 1);
  economy.add(balance, 'waveClearBonus', 0, 200, 5);

  const render = gui.addFolder('Quality');
  render.add(quality, 'pixelRatio', 0.5, 2, 0.25).onChange((v: number) => r3d.setPixelRatio(v));
  const info = { drawCalls: 0, triangles: 0 };
  render.add(info, 'drawCalls').listen().disable();
  render.add(info, 'triangles').listen().disable();
  setInterval(() => {
    info.drawCalls = r3d.renderer.info.render.calls;
    info.triangles = r3d.renderer.info.render.triangles;
  }, 1000);

  const spawnType = { type: 'basic' as EnemyType };
  const actions = {
    spawn: () => spawnEnemy(game, spawnType.type),
    gold: () => game.addGold(100),
    killAll: () => {
      for (const e of game.enemies.items) damageEnemy(game, e, Infinity);
    },
  };
  const a = gui.addFolder('Actions');
  a.add(spawnType, 'type', Object.keys(balance.enemies));
  a.add(actions, 'spawn').name('spawn enemy');
  a.add(actions, 'gold').name('+100 gold');
  a.add(actions, 'killAll').name('kill all (skip wave)');

  return gui;
}
