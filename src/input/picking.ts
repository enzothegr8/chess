import * as THREE from 'three';

export interface HoverState {
  index: number | null;
  depth: number;
  hitCount: number;
}

/**
 * Raycasts against the invisible pick-collider InstancedMesh and exposes the
 * full sorted hit list so interior cells (occluded by the outer shell) stay
 * reachable via hover-depth cycling.
 */
export class Picker {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hits: number[] = [];
  private depth = 0;
  private hasPointer = false;

  constructor(
    private readonly domElement: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly collider: THREE.InstancedMesh
  ) {
    domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    domElement.addEventListener('pointerleave', () => {
      this.hasPointer = false;
      this.hits = [];
      this.depth = 0;
    });

    domElement.addEventListener(
      'wheel',
      (e) => {
        if (!e.altKey) return;
        e.preventDefault();
        this.cycleDepth(e.deltaY > 0 ? 1 : -1);
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      if (e.code === 'BracketRight') this.cycleDepth(1);
      if (e.code === 'BracketLeft') this.cycleDepth(-1);
    });
  }

  private onPointerMove(e: PointerEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.hasPointer = true;
  }

  private cycleDepth(delta: number): void {
    if (this.hits.length === 0) return;
    this.depth = THREE.MathUtils.clamp(this.depth + delta, 0, this.hits.length - 1);
  }

  /** Re-raycasts using the latest pointer position; call once per frame. */
  update(): HoverState {
    if (!this.hasPointer) {
      this.hits = [];
      return { index: null, depth: 0, hitCount: 0 };
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObject(this.collider, false);

    const seen = new Set<number>();
    const newHits: number[] = [];
    for (const hit of intersections) {
      if (hit.instanceId === undefined) continue;
      if (seen.has(hit.instanceId)) continue;
      seen.add(hit.instanceId);
      newHits.push(hit.instanceId);
    }

    if (newHits.length !== this.hits.length) this.depth = 0;
    this.hits = newHits;

    const index = this.hits.length > 0 ? this.hits[this.depth] : null;
    return { index, depth: this.depth, hitCount: this.hits.length };
  }
}
