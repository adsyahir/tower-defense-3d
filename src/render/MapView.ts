import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
} from 'three';
import gsap from 'gsap';
import type { Grid } from '../game/grid';
import type { Path } from '../game/path';
import type { Tile, Vec2 } from '../game/types';

const TILE_HEIGHT = 0.2;

/** Ground tiles, path, spawn/exit markers and the tile highlight. */
export class MapView {
  readonly group = new Group();
  private readonly highlight: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly tmp: Vec2 = { x: 0, z: 0 };

  constructor(private grid: Grid, path: Path) {
    const grassCount = grid.cols * grid.rows - grid.pathTiles.size;
    const geo = new BoxGeometry(0.96, TILE_HEIGHT, 0.96);
    const grass = new InstancedMesh(geo, new MeshLambertMaterial({ color: '#6fae4f' }), grassCount);
    const road = new InstancedMesh(geo, new MeshLambertMaterial({ color: '#c9a66b' }), grid.pathTiles.size);
    grass.receiveShadow = road.receiveShadow = true;

    const m = new Matrix4();
    let gi = 0;
    let ri = 0;
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const p = grid.tileToWorld({ col, row }, this.tmp);
        if (grid.isPath(col, row)) {
          m.makeTranslation(p.x, -TILE_HEIGHT / 2 - 0.04, p.z);
          road.setMatrixAt(ri++, m);
        } else {
          m.makeTranslation(p.x, -TILE_HEIGHT / 2, p.z);
          grass.setMatrixAt(gi++, m);
        }
      }
    }
    road.count = ri; // path tiles outside the grid aren't drawn
    this.group.add(grass, road);

    // Base under the board so its edges don't float.
    const base = new Mesh(
      new BoxGeometry(grid.cols + 0.4, 0.4, grid.rows + 0.4),
      new MeshLambertMaterial({ color: '#4b3a2a' }),
    );
    base.position.y = -TILE_HEIGHT - 0.2;
    this.group.add(base);

    const markerGeo = new CylinderGeometry(0.3, 0.3, 0.1, 16);
    const start = path.points[0];
    const end = path.points[path.points.length - 1];
    const spawn = new Mesh(markerGeo, new MeshLambertMaterial({ color: '#d0453a' }));
    spawn.position.set(start.x, 0.0, start.z);
    const exit = new Mesh(markerGeo, new MeshLambertMaterial({ color: '#3a6fd0' }));
    exit.position.set(end.x, 0.0, end.z);
    this.group.add(spawn, exit);

    this.highlight = new Mesh(
      new PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.highlight.position.y = 0.01;
    this.highlight.visible = false;
    this.group.add(this.highlight);
  }

  showHighlight(tile: Tile, ok: boolean): void {
    const p = this.grid.tileToWorld(tile, this.tmp);
    this.highlight.position.x = p.x;
    this.highlight.position.z = p.z;
    this.highlight.material.color.set(ok ? '#7dff7d' : '#ff5050');
    this.highlight.material.opacity = 0.45;
    gsap.killTweensOf(this.highlight.material);
    this.highlight.visible = true;
  }

  /** Brief highlight that fades out — feedback for a placement attempt. */
  flash(tile: Tile, ok: boolean): void {
    this.showHighlight(tile, ok);
    gsap.to(this.highlight.material, {
      opacity: 0,
      duration: 0.5,
      ease: 'power1.in',
      onComplete: () => this.hideHighlight(),
    });
  }

  hideHighlight(): void {
    this.highlight.visible = false;
  }
}
