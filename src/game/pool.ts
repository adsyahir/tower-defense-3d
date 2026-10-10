/**
 * Fixed-identity object pool. `items` only grows; inactive items are reused.
 * Views can map items[i] -> mesh[i] because an item never changes index.
 */
export class Pool<T extends { active: boolean }> {
  readonly items: T[] = [];
  private free: T[] = [];
  private active = 0;

  constructor(private create: () => T, initialSize = 0) {
    for (let i = 0; i < initialSize; i++) {
      const item = create();
      item.active = false;
      this.items.push(item);
      this.free.push(item);
    }
  }

  acquire(): T {
    let item = this.free.pop();
    if (!item) {
      item = this.create();
      this.items.push(item);
    }
    item.active = true;
    this.active++;
    return item;
  }

  release(item: T): void {
    if (!item.active) return;
    item.active = false;
    this.free.push(item);
    this.active--;
  }

  releaseAll(): void {
    for (const item of this.items) this.release(item);
  }

  get activeCount(): number {
    return this.active;
  }
}
