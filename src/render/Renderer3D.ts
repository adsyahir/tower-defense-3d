import {
  CanvasTexture,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
} from 'three';
import { quality } from '../platform/device';
import { palette } from './style3d';

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

    this.scene.background = skyTexture();
    // Fades the far edges of the diorama into the horizon colour; the board itself stays crisp.
    this.scene.fog = new Fog(palette.fog, 26, 60);
    // Cool sky fill from above, warm bounce from the ground.
    this.scene.add(new HemisphereLight('#dcefff', '#9a7a55', 1.25));

    // Warm, low-ish key light for long readable shadows.
    this.sun = new DirectionalLight('#ffe2b5', 2.6);
    this.sun.position.set(-7, 13, 8);
    if (quality.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.02;
      const half = Math.max(mapSize.cols, mapSize.rows) / 2 + 3;
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

/** Vertical sky gradient as a tiny canvas texture (scene.background stretches it to the screen). */
function skyTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, palette.skyTop);
  g.addColorStop(0.55, '#b9dcef');
  g.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
