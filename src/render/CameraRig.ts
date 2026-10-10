import { PerspectiveCamera, TOUCH, Vector3 } from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

/** Perspective camera + MapControls, with the pan target clamped to the map. */
export class CameraRig {
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 200);
  readonly controls: MapControls;
  private readonly halfW: number;
  private readonly halfH: number;
  private readonly clamped = new Vector3();

  constructor(dom: HTMLElement, mapSize: { cols: number; rows: number }) {
    this.halfW = mapSize.cols / 2;
    this.halfH = mapSize.rows / 2;
    this.camera.position.set(0, 12.6, 9.6);

    const c = new MapControls(this.camera, dom);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.screenSpacePanning = false; // pan across the ground plane
    c.minDistance = 6;
    c.maxDistance = 30;
    c.maxPolarAngle = 1.2; // never look from below the ground
    c.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };
    c.target.set(0, 0, 0.8);
    c.update();
    this.controls = c;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    // Portrait-ish or narrow screens need a wider view to fit the map.
    this.camera.fov = this.camera.aspect < 1.4 ? 60 : this.camera.aspect > 1.9 ? 46 : 50;
    this.camera.updateProjectionMatrix();
  }

  update(): void {
    const c = this.controls;
    c.update();
    // Keep the target over the map; move the camera by the same amount so the view doesn't rotate.
    const t = c.target;
    this.clamped.set(
      Math.min(Math.max(t.x, -this.halfW), this.halfW),
      0,
      Math.min(Math.max(t.z, -this.halfH), this.halfH),
    );
    if (this.clamped.x !== t.x || this.clamped.z !== t.z || t.y !== 0) {
      this.camera.position.x += this.clamped.x - t.x;
      this.camera.position.y += this.clamped.y - t.y;
      this.camera.position.z += this.clamped.z - t.z;
      t.copy(this.clamped);
    }
  }
}
