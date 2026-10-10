/**
 * Fixed-identity object pool. `items` only grows (up to `capacity`); inactive items are reused.
 * Views can map items[i] -> instance i because an item never changes index, and size
 * their buffers to `capacity`.
 */
export class Pool<T extends { active: boolean }> {
  readonly items: T[] = [];
  private free: T[] = [];
  private active = 0;

  constructor(
    private create: () => T,
    initialSize = 0,
    readonly capacity = Infinity,
  ) {
    for (let i = 0; i < initialSize; i++) {
      const item = create();
      item.active = false;
      this.items.push(item);
      this.free.push(item);
    }
  }

  /** Returns null when the pool is at capacity. */
  acquire(): T | null {
    let item = this.free.pop();
    if (!item) {
      if (this.items.length >= this.capacity) return null;
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
