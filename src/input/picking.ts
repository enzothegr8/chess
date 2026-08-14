import * as THREE from 'three';
import { CELLS, N } from '../engine/config';
import { toWorld } from '../engine/coords';

export interface HoverState {
  index: number | null;
  depth: number;
  hitCount: number;
}

const MIN_RADIUS = 6;
const MAX_RADIUS = 40;
const RADIUS_FACTOR = 0.45;

function isTextInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/**
 * Screen-space node picking: the lattice is a set of points, so we pick
 * against the points directly rather than raycasting against collider
 * volumes. Recomputation happens on pointermove (event-driven, not polled
 * every frame) so it never fights keyboard-driven active-cell changes —
 * the moment the mouse actually moves, hover takes over again; until then,
 * whatever last set the active cell stays in effect.
 */
export class Picker {
  private readonly v = new THREE.Vector3();

  // preallocated candidate scratch buffers — no per-call array allocation
  private readonly candIdx = new Int32Array(CELLS);
  private readonly candDistSq = new Float32Array(CELLS);
  private candCount = 0;
  private cycleIndex = 0;

  constructor(
    domElement: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly positions: Float32Array,
    private readonly onChange: (state: HoverState) => void
  ) {
    domElement.addEventListener('pointermove', (e) => {
      const rect = domElement.getBoundingClientRect();
      this.recompute(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
    });

    window.addEventListener('keydown', (e) => {
      if (isTextInputFocused()) return;
      if (e.code === 'BracketRight') this.cycle(1);
      if (e.code === 'BracketLeft') this.cycle(-1);
    });
  }

  private cycle(delta: number): void {
    if (this.candCount === 0) return;
    this.cycleIndex = THREE.MathUtils.clamp(this.cycleIndex + delta, 0, this.candCount - 1);
    this.emit();
  }

  private emit(): void {
    const index = this.candCount > 0 ? this.candIdx[this.cycleIndex] : null;
    this.onChange({ index, depth: this.cycleIndex, hitCount: this.candCount });
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

  private recompute(mouseX: number, mouseY: number, width: number, height: number): void {
    const radius = this.adaptiveRadius(width, height);
    const camPos = this.camera.position;

    let count = 0;
    for (let i = 0; i < CELLS; i++) {
      const px = this.positions[i * 3];
      const py = this.positions[i * 3 + 1];
      const pz = this.positions[i * 3 + 2];

      const [sx, sy, sz] = this.project(px, py, pz, width, height);
      if (sz < -1 || sz > 1) continue;

      const d = Math.hypot(sx - mouseX, sy - mouseY);
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

    this.candCount = count;
    this.cycleIndex = 0;
    this.emit();
  }
}
