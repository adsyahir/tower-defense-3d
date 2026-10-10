import type { Object3D } from 'three';

/**
 * One scene object per pool slot: game pool item i is always drawn by object i.
 * Objects are created on first use, hidden while their item is inactive, never destroyed.
 */
export class MeshPool<T extends { active: boolean }, O extends Object3D> {
  readonly objects: O[] = [];

  constructor(
    private parent: Object3D,
    private items: T[],
    private create: () => O,
    private update: (obj: O, item: T) => void,
  ) {}

  sync(): void {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let obj = this.objects[i];
      if (!obj) {
        if (!item.active) continue;
        obj = this.create();
        this.objects.push(obj);
        this.parent.add(obj);
      }
      obj.visible = item.active;
      if (item.active) this.update(obj, item);
    }
  }
}
