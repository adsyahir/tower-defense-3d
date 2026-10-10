import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
} from 'three';
import { quality } from '../platform/device';

type ResizeFn = (width: number, height: number) => void;

/** Owns the WebGL renderer, scene, lights and canvas sizing. */
export class Renderer3D {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly sun: DirectionalLight;
  private resizeFns: ResizeFn[] = [];
  width = 1;
  height = 1;

  constructor(container: HTMLElement, mapSize: { cols: number; rows: number }) {
    this.renderer = new WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new Color('#9fc7e0');
    this.scene.add(new HemisphereLight('#ffffff', '#5b6b4a', 1.6));

    this.sun = new DirectionalLight('#ffffff', 1.8);
    this.sun.position.set(-6, 12, 6);
    if (quality.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      const half = Math.max(mapSize.cols, mapSize.rows) / 2 + 1;
      const cam = this.sun.shadow.camera;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.near = 1;
      cam.far = 40;
    }
    this.scene.add(this.sun);

    // ResizeObserver follows mobile URL-bar changes more reliably than window 'resize'.
    new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      this.resize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    }).observe(container);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  onResize(fn: ResizeFn): void {
    this.resizeFns.push(fn);
    fn(this.width, this.height);
  }

  setPixelRatio(ratio: number): void {
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.width, this.height, false);
  }

  render(camera: Camera): void {
    this.renderer.render(this.scene, camera);
  }

  private resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    for (const fn of this.resizeFns) fn(width, height);
  }
}
