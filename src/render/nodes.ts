import * as THREE from 'three';
import { N, CELL, CELLS } from '../engine/config';

const IDLE = 0;
const REACHABLE = 1;
const CAPTURABLE = 2;
const ACTIVE = 3;
const OCCUPIED = 4;

const STATE_COLOR = [
  new THREE.Color('#5e82ae'), // idle          --lattice
  new THREE.Color('#38e1ff'), // reachable     --holo
  new THREE.Color('#ff3b6b'), // capturable    --alarm
  new THREE.Color('#eafeff'), // active        --holo-core
  new THREE.Color('#eafeff'), // occupied      --holo-core
];
const STATE_SCALE = [1.0, 1.4, 1.4, 1.8, 2.0];

const BG_COLOR = new THREE.Color('#04060f');
const NEAR_OPACITY = 1.0;
const FAR_OPACITY = 0.5;

/**
 * Every lattice node in one InstancedMesh (one draw call). Node state
 * (idle/reachable/capturable/active/occupied) drives color and scale;
 * camera-relative depth further blends each node's color toward the
 * background so the far wall of the cube reads as further away.
 */
export class NodeField {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly occupiedRing: THREE.Mesh;

  private readonly boardState = new Uint8Array(CELLS); // reachable/capturable/occupied/idle only
  private readonly cellState = new Uint8Array(CELLS); // boardState + the active-cell overlay
  private activeCell: number | null = null;

  private readonly dummy = new THREE.Object3D();
  private readonly blended = new THREE.Color();
  private readonly camDir = new THREE.Vector3();

  constructor(private readonly positions: Float32Array) {
    const geometry = new THREE.OctahedronGeometry(CELL * 0.09, 0);
    const material = new THREE.MeshBasicMaterial();
    this.mesh = new THREE.InstancedMesh(geometry, material, CELLS);

    for (let i = 0; i < CELLS; i++) {
      this.writeMatrix(i);
      this.mesh.setColorAt(i, STATE_COLOR[IDLE]);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.group.add(this.mesh);

    const ringGeo = new THREE.RingGeometry(CELL * 0.24, CELL * 0.3, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#eafeff',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.occupiedRing = new THREE.Mesh(ringGeo, ringMat);
    this.occupiedRing.renderOrder = 6;
    this.occupiedRing.visible = false;
    this.group.add(this.occupiedRing);
  }

  /** Board-derived state: called whenever the piece moves or a blocker is toggled. */
  setBoardState(reachable: Iterable<number>, capturable: Iterable<number>, occupiedCell: number | null): void {
    this.boardState.fill(IDLE);
    for (const i of reachable) this.boardState[i] = REACHABLE;
    for (const i of capturable) this.boardState[i] = CAPTURABLE;
    if (occupiedCell !== null) this.boardState[occupiedCell] = OCCUPIED;

    if (occupiedCell !== null) {
      this.occupiedRing.position.set(
        this.positions[occupiedCell * 3],
        this.positions[occupiedCell * 3 + 1],
        this.positions[occupiedCell * 3 + 2]
      );
      this.occupiedRing.visible = true;
    } else {
      this.occupiedRing.visible = false;
    }

    this.cellState.set(this.boardState);
    if (this.activeCell !== null) {
      this.cellState[this.activeCell] = Math.max(this.cellState[this.activeCell], ACTIVE);
    }

    for (let i = 0; i < CELLS; i++) this.writeMatrix(i);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Cursor state: called on every hover change or nav-key press. O(1) — touches at most two cells. */
  setActiveCell(next: number | null): void {
    const previous = this.activeCell;
    if (previous !== null) {
      this.cellState[previous] = this.boardState[previous];
      this.writeMatrix(previous);
    }
    if (next !== null) {
      this.cellState[next] = Math.max(this.boardState[next], ACTIVE);
      this.writeMatrix(next);
    }
    this.activeCell = next;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private writeMatrix(i: number): void {
    this.dummy.position.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
    this.dummy.scale.setScalar(STATE_SCALE[this.cellState[i]]);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  /** Per-frame: blend every node's color toward the background by camera-relative depth. */
  update(camera: THREE.Camera): void {
    camera.getWorldDirection(this.camDir);
    const camPos = camera.position;
    const half = (N * CELL) / 2;

    let near = Infinity;
    let far = -Infinity;
    for (let cx = -1; cx <= 1; cx += 2) {
      for (let cy = -1; cy <= 1; cy += 2) {
        for (let cz = -1; cz <= 1; cz += 2) {
          const d =
            (cx * half - camPos.x) * this.camDir.x +
            (cy * half - camPos.y) * this.camDir.y +
            (cz * half - camPos.z) * this.camDir.z;
          if (d < near) near = d;
          if (d > far) far = d;
        }
      }
    }
    const span = far - near || 1;

    for (let i = 0; i < CELLS; i++) {
      const px = this.positions[i * 3];
      const py = this.positions[i * 3 + 1];
      const pz = this.positions[i * 3 + 2];

      const d = (px - camPos.x) * this.camDir.x + (py - camPos.y) * this.camDir.y + (pz - camPos.z) * this.camDir.z;
      const t = THREE.MathUtils.clamp((d - near) / span, 0, 1);
      const opacity = THREE.MathUtils.lerp(NEAR_OPACITY, FAR_OPACITY, t);

      this.blended.copy(BG_COLOR).lerp(STATE_COLOR[this.cellState[i]], opacity);
      this.mesh.setColorAt(i, this.blended);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    if (this.occupiedRing.visible) this.occupiedRing.quaternion.copy(camera.quaternion);
  }
}
