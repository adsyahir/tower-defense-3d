import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { Grid } from '../game/grid';
import type { Tile } from '../game/types';

const TAP_MAX_MOVE = 10; // px
const TAP_MAX_MS = 400;

/**
 * Turns pointer input into tile taps. A tap is one pointer that barely moved and
 * was released quickly, with no second finger during the gesture — so panning
 * and pinching (handled by MapControls) never count.
 */
export class Picker {
  onTap: (tile: Tile | null) => void = () => {};
  /** Mouse only: hovered tile, for a placement preview. */
  onHover: (tile: Tile | null) => void = () => {};

  private readonly pointers = new Set<number>();
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private multiTouch = false;

  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly hit = new Vector3();

  constructor(private canvas: HTMLCanvasElement, private camera: Camera, private grid: Grid) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.cancel);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerleave', () => this.onHover(null));
  }

  private down = (e: PointerEvent) => {
    this.pointers.add(e.pointerId);
    if (this.pointers.size === 1) {
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startTime = performance.now();
      this.multiTouch = false;
    } else {
      this.multiTouch = true;
    }
  };

  private up = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.multiTouch || e.button > 0) return;
    const moved = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
    if (moved < TAP_MAX_MOVE && performance.now() - this.startTime < TAP_MAX_MS) {
      this.onTap(this.tileAt(e.clientX, e.clientY));
    }
  };

  private cancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.multiTouch = true;
  };

  private move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || this.pointers.size > 0) return;
    this.onHover(this.tileAt(e.clientX, e.clientY));
  };

  tileAt(clientX: number, clientY: number): Tile | null {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.ground, this.hit)) return null;
    return this.grid.worldToTile(this.hit.x, this.hit.z);
  }
}
