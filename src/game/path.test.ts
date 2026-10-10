import { describe, expect, it } from 'vitest';
import { map01 } from '../config/map01';
import { Grid, tileKey } from './grid';
import { Path } from './path';

describe('Path', () => {
  const path = new Path([
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 3 },
  ]);

  it('has the summed segment length', () => {
    expect(path.totalLength).toBe(7);
  });

  it('starts at the first point and ends at the last', () => {
    const out = { x: 0, z: 0 };
    expect(path.positionAt(0, out)).toEqual({ x: 0, z: 0 });
    expect(path.positionAt(7, out)).toEqual({ x: 4, z: 3 });
    expect(path.positionAt(99, out)).toEqual({ x: 4, z: 3 });
  });

  it('interpolates on the correct segment and reports direction', () => {
    const out = { x: 0, z: 0 };
    const dir = { x: 0, z: 0 };
    path.positionAt(2, out, dir);
    expect(out).toEqual({ x: 2, z: 0 });
    expect(dir).toEqual({ x: 1, z: 0 });
    path.positionAt(5.5, out, dir);
    expect(out).toEqual({ x: 4, z: 1.5 });
    expect(dir).toEqual({ x: 0, z: 1 });
  });
});

describe('Grid', () => {
  const grid = new Grid(map01);

  it('marks every tile between waypoints as path', () => {
    for (let c = 0; c <= 4; c++) expect(grid.pathTiles.has(tileKey(c, 2))).toBe(true);
    for (let r = 2; r <= 7; r++) expect(grid.pathTiles.has(tileKey(4, r))).toBe(true);
    expect(grid.isPath(0, 0)).toBe(false);
  });

  it('converts tiles to world and back', () => {
    const w = grid.tileToWorld({ col: 3, row: 5 }, { x: 0, z: 0 });
    expect(grid.worldToTile(w.x, w.z)).toEqual({ col: 3, row: 5 });
    expect(grid.worldToTile(-100, 0)).toBeNull();
  });

  it('rejects diagonal segments', () => {
    expect(() => new Grid({ cols: 4, rows: 4, waypoints: [{ col: 0, row: 0 }, { col: 1, row: 1 }] })).toThrow();
  });
});
