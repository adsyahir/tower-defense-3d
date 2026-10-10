import type { WaveDef } from '../config/balance';
import type { EnemyType } from './types';

/** Spawns the groups of one wave over time. Each group runs on its own clock from wave start. */
export class WaveScheduler {
  private def: WaveDef = [];
  private spawned: number[] = [];
  private elapsed = 0;

  start(def: WaveDef): void {
    this.def = def;
    this.spawned = def.map(() => 0);
    this.elapsed = 0;
  }

  update(dt: number, spawn: (type: EnemyType) => void): void {
    this.elapsed += dt;
    for (let g = 0; g < this.def.length; g++) {
      const group = this.def[g];
      while (this.spawned[g] < group.count && this.elapsed >= group.delay + this.spawned[g] * group.interval) {
        this.spawned[g]++;
        spawn(group.type);
      }
    }
  }

  /** True once every enemy of the wave has been spawned. */
  get done(): boolean {
    for (let g = 0; g < this.def.length; g++) if (this.spawned[g] < this.def[g].count) return false;
    return true;
  }

  clear(): void {
    this.start([]);
  }
}
