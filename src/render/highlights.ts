import * as THREE from 'three';
import { N, CELL } from '../engine/config';
import { toWorld } from '../engine/coords';

const HOVER_COLOR = new THREE.Color('#38e1ff');
const BASE_COLOR = new THREE.Color('#1b3556');

/** Manages the single hovered-cell marker: scale-up + full-brightness recolor. */
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
      this.dummy.scale.setScalar(2.2);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);
      this.mesh.setColorAt(index, HOVER_COLOR);
    }

    this.current = index;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Three faint guide planes through a cell, one per axis, for depth legibility. */
export class GuidePlanes {
  readonly group: THREE.Group;
  private readonly planeX: THREE.Mesh;
  private readonly planeY: THREE.Mesh;
  private readonly planeZ: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();
    const size = N * CELL;
    const mat = (color: string) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

    const geo = new THREE.PlaneGeometry(size, size);

    this.planeX = new THREE.Mesh(geo, mat('#38e1ff'));
    this.planeX.rotation.y = Math.PI / 2;

    this.planeY = new THREE.Mesh(geo, mat('#eafeff'));
    this.planeY.rotation.x = Math.PI / 2;

    this.planeZ = new THREE.Mesh(geo, mat('#ffb13d'));

    this.group.add(this.planeX, this.planeY, this.planeZ);
    this.group.visible = false;
  }

  show(x: number, y: number, z: number): void {
    const w = toWorld(x, y, z);
    this.planeX.position.set(w.x, 0, 0);
    this.planeY.position.set(0, w.y, 0);
    this.planeZ.position.set(0, 0, w.z);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }
}

/** Hollow ring marker used by the piece lab to flag reachable/attacked cells. */
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

/** Translucent beam from `from` to `to`, for sliding movement components. */
export function makeBeam(from: THREE.Vector3, to: THREE.Vector3, color: string): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35, depthTest: false });
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
