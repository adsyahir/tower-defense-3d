import type { MapDef, Tile, Vec2 } from './types';

export const tileKey = (col: number, row: number) => `${col},${row}`;

export class Grid {
  readonly cols: number;
  readonly rows: number;
  /** Keys of every tile the path passes through. */
  readonly pathTiles = new Set<string>();

  constructor(map: MapDef) {
    this.cols = map.cols;
    this.rows = map.rows;
    const wp = map.waypoints;
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i];
      const b = wp[i + 1];
      if (a.col !== b.col && a.row !== b.row) {
        throw new Error(`Path segment ${i} is not axis-aligned`);
      }
      const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row));
      const dc = Math.sign(b.col - a.col);
      const dr = Math.sign(b.row - a.row);
      for (let s = 0; s <= steps; s++) this.pathTiles.add(tileKey(a.col + dc * s, a.row + dr * s));
    }
  }

  tileToWorld(tile: Tile, out: Vec2): Vec2 {
    out.x = tile.col - this.cols / 2 + 0.5;
    out.z = tile.row - this.rows / 2 + 0.5;
    return out;
  }

  /** Returns null when outside the grid. */
  worldToTile(x: number, z: number): Tile | null {
    const col = Math.floor(x + this.cols / 2);
    const row = Math.floor(z + this.rows / 2);
    return this.isInside(col, row) ? { col, row } : null;
  }

  isInside(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  isPath(col: number, row: number): boolean {
    return this.pathTiles.has(tileKey(col, row));
  }
}
