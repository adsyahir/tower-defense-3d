import type { Vec2 } from './types';

/** Polyline path through world-space points, sampled by distance travelled. */
export class Path {
  readonly points: Vec2[];
  /** cumulative[i] = distance from start to points[i]. */
  readonly cumulative: number[];
  readonly totalLength: number;

  constructor(points: Vec2[]) {
    if (points.length < 2) throw new Error('Path needs at least 2 points');
    this.points = points.map((p) => ({ x: p.x, z: p.z }));
    this.cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.totalLength = this.cumulative[this.cumulative.length - 1];
  }

  /** Writes the position at `distance` into `out` (and the unit direction into `dir`). No allocation. */
  positionAt(distance: number, out: Vec2, dir?: Vec2): Vec2 {
    const d = Math.min(Math.max(distance, 0), this.totalLength);
    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i] < d) i++;
    const a = this.points[i - 1];
    const b = this.points[i];
    const segLen = this.cumulative[i] - this.cumulative[i - 1];
    const t = segLen > 0 ? (d - this.cumulative[i - 1]) / segLen : 0;
    out.x = a.x + (b.x - a.x) * t;
    out.z = a.z + (b.z - a.z) * t;
    if (dir && segLen > 0) {
      dir.x = (b.x - a.x) / segLen;
      dir.z = (b.z - a.z) / segLen;
    }
    return out;
  }
}
