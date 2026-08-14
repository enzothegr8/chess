import * as THREE from 'three';
import { N, CELL } from '../engine/config';
import { toWorld } from '../engine/coords';

const HOVER_COLOR = new THREE.Color('#eafeff'); // --holo-core
const BASE_COLOR = new THREE.Color('#1b3556');

/** Manages the single hovered-node marker: scale-up + full-brightness recolor. */
export class HoverHighlight {
  private mesh: THREE.InstancedMesh;
  private current: number | null = null;
  private readonly baseMatrix = new THREE.Matrix4();
  private readonly dummy = new THREE.Object3D();

  constructor(mesh: THREE.InstancedMesh) {
    this.mesh = mesh;
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, BASE_COLOR);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  setHover(index: number | null): void {
    if (index === this.current) return;

    if (this.current !== null) {
      this.mesh.setMatrixAt(this.current, this.baseMatrix);
      this.mesh.setColorAt(this.current, BASE_COLOR);
    }

    if (index !== null) {
      this.mesh.getMatrixAt(index, this.baseMatrix);
      this.dummy.position.setFromMatrixPosition(this.baseMatrix);
      this.dummy.scale.setScalar(1.8);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);
      this.mesh.setColorAt(index, HOVER_COLOR);
    }

    this.current = index;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// grid coordinate 0 maps to negative world-space on x/y but positive on z
// (world-forward is -z), so the "origin corner wall" — where the axis
// rulers read 0 — sits on opposite sides for z versus x/y.
const ORIGIN_SIGN: Record<'x' | 'y' | 'z', 1 | -1> = { x: -1, y: -1, z: 1 };
const AXIS_COLOR: Record<'x' | 'y' | 'z', string> = { x: '#38e1ff', y: '#eafeff', z: '#ffb13d' };

interface AxisVisual {
  bright: THREE.Line;
  dim: THREE.Line;
  originDot: THREE.Mesh;
  farDot: THREE.Mesh;
}

/**
 * Three crosshair lines through the hovered node, one per axis, spanning
 * the full bounding cube and brightening toward the origin-corner wall so
 * each one visibly points at the ruler that reads its coordinate.
 */
export class GuideLines {
  readonly group = new THREE.Group();
  private readonly axes: Record<'x' | 'y' | 'z', AxisVisual>;

  constructor() {
    const make = (axis: 'x' | 'y' | 'z'): AxisVisual => {
      const color = AXIS_COLOR[axis];
      const brightMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false });
      const dimMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.16, depthTest: false, depthWrite: false });
      const dotGeo = new THREE.SphereGeometry(CELL * 0.045, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false });

      const emptyGeo = () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const bright = new THREE.Line(emptyGeo(), brightMat);
      const dim = new THREE.Line(emptyGeo(), dimMat);
      const originDot = new THREE.Mesh(dotGeo, dotMat.clone());
      const farDot = new THREE.Mesh(dotGeo, dotMat.clone());
      bright.renderOrder = 6;
      dim.renderOrder = 6;
      originDot.renderOrder = 6;
      farDot.renderOrder = 6;

      this.group.add(bright, dim, originDot, farDot);
      return { bright, dim, originDot, farDot };
    };

    this.axes = { x: make('x'), y: make('y'), z: make('z') };
    this.group.visible = false;
  }

  show(x: number, y: number, z: number): void {
    const w = toWorld(x, y, z);
    const half = (N * CELL) / 2;
    const node = new THREE.Vector3(w.x, w.y, w.z);

    this.updateAxis('x', node, half);
    this.updateAxis('y', node, half);
    this.updateAxis('z', node, half);

    this.group.visible = true;
  }

  private updateAxis(axis: 'x' | 'y' | 'z', node: THREE.Vector3, half: number): void {
    const sign = ORIGIN_SIGN[axis];
    const origin = node.clone();
    const far = node.clone();
    origin[axis] = sign * half;
    far[axis] = -sign * half;

    const visual = this.axes[axis];
    visual.bright.geometry.setFromPoints([node, origin]);
    visual.dim.geometry.setFromPoints([node, far]);
    visual.originDot.position.copy(origin);
    visual.farDot.position.copy(far);
  }

  hide(): void {
    this.group.visible = false;
  }
}

/** Hollow ring marker used to flag reachable cells and ray-blocked captures. */
export function makeMarker(color: string): THREE.Mesh {
  const geo = new THREE.RingGeometry(CELL * 0.14, CELL * 0.2, 16);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  return mesh;
}

/** Translucent beam from `from` to `to`, for sliding movement components. Fades with distance. */
export function makeBeam(from: THREE.Vector3, to: THREE.Vector3, color: string): THREE.Line {
  const start = new THREE.Color(color);
  const end = start.clone().multiplyScalar(0.1);
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  geo.setAttribute(
    'color',
    new THREE.Float32BufferAttribute([start.r, start.g, start.b, end.r, end.g, end.b], 3)
  );
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthTest: false,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.renderOrder = 4;
  return line;
}

/** Short arc from `from` to `to`, for leaping movement components. */
export function makeArc(from: THREE.Vector3, to: THREE.Vector3, color: string): THREE.Line {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  mid.y += CELL * 0.35;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const points = curve.getPoints(12);
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, depthTest: false });
  const line = new THREE.Line(geo, mat);
  line.renderOrder = 4;
  return line;
}
