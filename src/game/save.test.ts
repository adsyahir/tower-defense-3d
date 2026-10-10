import { beforeEach, describe, expect, it } from 'vitest';
import { balance } from '../config/balance';
import { map01 } from '../config/map01';
import { Game } from './Game';
import { parseRunSave, SAVE_VERSION } from './save';

let game: Game;
beforeEach(() => {
  game = new Game(map01);
});

describe('run save', () => {
  it('round-trips wave, gold, lives and towers through JSON', () => {
    game.state.gold = 1000;
    game.placeTower('cannon', { col: 1, row: 1 });
    game.upgradeTower(game.towers[0]);
    game.placeTower('frost', { col: 2, row: 4 });
    game.state.wave = 3;
    game.state.lives = 14;
    const snap = game.snapshot()!;
    const json = JSON.parse(JSON.stringify(snap));

    const other = new Game(map01);
    const placed: string[] = [];
    other.events.on('towerPlaced', (t) => placed.push(`${t.type}${t.level}`));
    expect(other.restore(parseRunSave(json)!)).toBe(true);
    expect(other.state).toMatchObject({ phase: 'build', wave: 3, lives: 14, gold: game.state.gold });
    expect(other.towers.map((t) => [t.type, t.level, t.tile.col, t.tile.row, t.spent])).toEqual(
      game.towers.map((t) => [t.type, t.level, t.tile.col, t.tile.row, t.spent]),
    );
    expect(placed).toEqual(['cannon2', 'frost1']);
    // Restored towers occupy their tiles.
    expect(other.canPlace({ col: 1, row: 1 })).toBe(false);
  });

  it('only snapshots between waves', () => {
    expect(game.snapshot()).not.toBeNull();
    game.startWave();
    expect(game.snapshot()).toBeNull();
  });

  it('rejects malformed or foreign data', () => {
    expect(parseRunSave(null)).toBeNull();
    expect(parseRunSave('nope')).toBeNull();
    expect(parseRunSave({ v: SAVE_VERSION + 1, wave: 1, gold: 1, lives: 1, towers: [] })).toBeNull();
    expect(parseRunSave({ v: SAVE_VERSION, wave: -1, gold: 1, lives: 1, towers: [] })).toBeNull();
    expect(parseRunSave({ v: SAVE_VERSION, wave: 1, gold: 1, lives: 0, towers: [] })).toBeNull();
    expect(parseRunSave({ v: SAVE_VERSION, wave: 1, gold: 1, lives: 3, towers: 'x' })).toBeNull();
  });

  it('drops invalid towers but keeps the rest', () => {
    const save = parseRunSave({
      v: SAVE_VERSION,
      wave: 2,
      gold: 50,
      lives: 10,
      towers: [
        { type: 'laser', level: 1, col: 1, row: 1, spent: 10 },
        { type: 'arrow', level: 9, col: 2, row: 1, spent: 40 },
        { type: 'arrow', level: 1, col: 0, row: 2, spent: 40 }, // on the path
        { type: 'arrow', level: 1, col: 2, row: 1, spent: 40 }, // duplicate tile
      ],
    })!;
    expect(game.restore(save)).toBe(true);
    expect(game.towers.map((t) => [t.type, t.level, t.tile.col])).toEqual([['arrow', 3, 2]]);
  });

  it('refuses a save past the last wave', () => {
    const save = parseRunSave({ v: SAVE_VERSION, wave: balance.waves.length, gold: 1, lives: 1, towers: [] });
    expect(save === null || !game.restore(save)).toBe(true);
  });
});

describe('next wave summary', () => {
  it('totals enemies by type for the upcoming wave', () => {
    game.state.wave = 2; // next is balance.waves[2]
    const expected: Record<string, number> = {};
    for (const g of balance.waves[2]) expected[g.type] = (expected[g.type] ?? 0) + g.count;
    expect(Object.fromEntries(game.nextWaveSummary()!.map((s) => [s.type, s.count]))).toEqual(expected);
  });

  it('is null when there is no next wave', () => {
    game.state.wave = balance.waves.length;
    expect(game.nextWaveSummary()).toBeNull();
  });
});
