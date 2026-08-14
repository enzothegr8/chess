import * as THREE from 'three';
import { CELLS, N } from '../engine/config';
import { toWorld, xOf, yOf, zOf } from '../engine/coords';

export interface HoverState {
  index: number | null;
  depth: number;
  hitCount: number;
}

function buildCellCenters(): Float32Array {
  const positions = new Float32Array(CELLS * 3);
  for (let i = 0; i < CELLS; i++) {
    const w = toWorld(xOf(i), yOf(i), zOf(i));
    positions[i * 3] = w.x;
    positions[i * 3 + 1] = w.y;
    positions[i * 3 + 2] = w.z;
  }
  return positions;
}

const MIN_RADIUS = 6;
const MAX_RADIUS = 40;
const RADIUS_FACTOR = 0.45;

/**
 * Screen-space node picking: the lattice is a set of points, so we pick
 * against the points directly rather than raycasting against collider
 * volumes. Every cell center is projected to screen space each frame and
 * the nearest one under the cursor, within an adaptive pixel radius, wins.
 */
export class Picker {
  private readonly positions = buildCellCenters();
  private readonly v = new THREE.Vector3();

  // preallocated candidate scratch buffers — no per-frame array allocation
  private readonly candIdx = new Int32Array(CELLS);
  private readonly candDistSq = new Float32Array(CELLS);
  private candCount = 0;

  private cycleIndex = 0;
  private mouseX = 0;
  private mouseY = 0;
  private hasPointer = false;

  constructor(
    private readonly domElement: HTMLElement,
    private readonly camera: THREE.Camera
  ) {
    domElement.addEventListener('pointermove', (e) => {
      const rect = domElement.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.hasPointer = true;
    });

    domElement.addEventListener('pointerleave', () => {
      this.hasPointer = false;
      this.candCount = 0;
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'BracketRight') this.cycle(1);
      if (e.code === 'BracketLeft') this.cycle(-1);
    });
  }

  private cycle(delta: number): void {
    if (this.candCount === 0) return;
    this.cycleIndex = THREE.MathUtils.clamp(this.cycleIndex + delta, 0, this.candCount - 1);
  }

  private project(x: number, y: number, z: number, width: number, height: number): [number, number, number] {
    this.v.set(x, y, z).project(this.camera);
    const sx = (this.v.x * 0.5 + 0.5) * width;
    const sy = (-this.v.y * 0.5 + 0.5) * height;
    return [sx, sy, this.v.z];
  }

  private adaptiveRadius(width: number, height: number): number {
    const c = Math.floor(N / 2);
    const cNext = Math.min(c + 1, N - 1);
    const a = toWorld(c, c, c);
    const b = toWorld(cNext, c, c);
    const [ax, ay] = this.project(a.x, a.y, a.z, width, height);
    const [bx, by] = this.project(b.x, b.y, b.z, width, height);
    const pitchPx = Math.hypot(bx - ax, by - ay) || MAX_RADIUS;
    return THREE.MathUtils.clamp(pitchPx * RADIUS_FACTOR, MIN_RADIUS, MAX_RADIUS);
  }

  /** Re-projects every cell center against the latest pointer position; call once per frame. */
  update(): HoverState {
    if (!this.hasPointer) {
      this.candCount = 0;
      return { index: null, depth: 0, hitCount: 0 };
    }

    const rect = this.domElement.getBoundingClientRect();
    const { width, height } = rect;
    const radius = this.adaptiveRadius(width, height);
    const camPos = this.camera.position;

    let count = 0;
    for (let i = 0; i < CELLS; i++) {
      const px = this.positions[i * 3];
      const py = this.positions[i * 3 + 1];
      const pz = this.positions[i * 3 + 2];

      const [sx, sy, sz] = this.project(px, py, pz, width, height);
      if (sz < -1 || sz > 1) continue;

      const d = Math.hypot(sx - this.mouseX, sy - this.mouseY);
      if (d > radius) continue;

      const dx = px - camPos.x;
      const dy = py - camPos.y;
      const dz = pz - camPos.z;
      this.candIdx[count] = i;
      this.candDistSq[count] = dx * dx + dy * dy + dz * dz;
      count++;
    }

    // insertion sort by camera distance ascending — candidate counts are
    // tiny (single digits) so this stays effectively O(count)
    for (let i = 1; i < count; i++) {
      const idx = this.candIdx[i];
      const dist = this.candDistSq[i];
      let j = i - 1;
      while (j >= 0 && this.candDistSq[j] > dist) {
        this.candIdx[j + 1] = this.candIdx[j];
        this.candDistSq[j + 1] = this.candDistSq[j];
        j--;
      }
      this.candIdx[j + 1] = idx;
      this.candDistSq[j + 1] = dist;
    }

    if (count !== this.candCount) this.cycleIndex = 0;
    this.candCount = count;
    this.cycleIndex = Math.min(this.cycleIndex, Math.max(count - 1, 0));

    const index = count > 0 ? this.candIdx[this.cycleIndex] : null;
    return { index, depth: this.cycleIndex, hitCount: count };
  }
}
