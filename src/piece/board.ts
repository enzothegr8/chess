import * as THREE from 'three';
import { CELLS, CELL } from '../engine/config';
import { inBounds, toIndex, toWorld, tuple } from '../engine/coords';
import { generateMoves, EMPTY, FRIENDLY, type PieceDef } from '../engine/movement';
import { makeBeam } from '../render/highlights';
import { ROOK } from '../engine/pieces';

export interface PieceHudState {
  name: string;
  cell: [number, number, number];
  reachable: number;
}

export interface PieceBoardCallbacks {
  onChange: () => void;
}

/**
 * Owns the single active piece, its blockers, and the always-on move-set
 * computation (reachable/capturable cells, which cell the piece occupies).
 * Node coloring lives in render/nodes.ts — this class only decides state
 * and draws the ray beams and blocker cubes.
 */
export class PieceBoard {
  readonly visuals = new THREE.Group();
  readonly reachable = new Set<number>();
  readonly capturable = new Set<number>();

  private readonly def: PieceDef = ROOK;
  private pieceCell: number | null = null;
  private readonly blockers = new Set<number>();

  private readonly occupancy = new Uint8Array(CELLS);
  private readonly moveBuf = new Int32Array(CELLS);

  constructor(private readonly callbacks: PieceBoardCallbacks) {}

  getPieceCell(): number | null {
    return this.pieceCell;
  }

  /** Place the piece if unplaced, or move it if `index` is a legal (reachable) destination. */
  activateCell(index: number): void {
    if (index === this.pieceCell) return;

    if (this.pieceCell === null) {
      this.blockers.delete(index);
      this.pieceCell = index;
      this.recompute();
      return;
    }

    if (this.reachable.has(index)) {
      this.blockers.delete(index);
      this.pieceCell = index;
      this.recompute();
    }
  }

  removePiece(): void {
    if (this.pieceCell === null) return;
    this.pieceCell = null;
    this.recompute();
  }

  toggleBlocker(index: number): void {
    if (index === this.pieceCell) return;
    if (this.blockers.has(index)) this.blockers.delete(index);
    else this.blockers.add(index);
    this.recompute();
  }

  clear(): void {
    this.pieceCell = null;
    this.blockers.clear();
    this.recompute();
  }

  getHudState(): PieceHudState | null {
    if (this.pieceCell === null) return null;
    return { name: this.def.name, cell: tuple(this.pieceCell), reachable: this.reachable.size };
  }

  private rebuildOccupancy(): void {
    this.occupancy.fill(EMPTY);
    for (const b of this.blockers) this.occupancy[b] = FRIENDLY;
  }

  private recompute(): void {
    this.clearVisuals();
    this.drawBlockerCubes();
    this.reachable.clear();
    this.capturable.clear();

    if (this.pieceCell === null) {
      this.notify();
      return;
    }

    this.rebuildOccupancy();
    const moveCount = generateMoves(this.pieceCell, this.def, this.occupancy, this.moveBuf);
    for (let i = 0; i < moveCount; i++) this.reachable.add(this.moveBuf[i]);

    this.drawRays();
    this.notify();
  }

  private drawRays(): void {
    if (this.pieceCell === null) return;
    const [fx, fy, fz] = tuple(this.pieceCell);
    const fromW = toWorld(fx, fy, fz);
    const from = new THREE.Vector3(fromW.x, fromW.y, fromW.z);

    for (const comp of this.def.components) {
      const effMin = comp.slide ? comp.minRange : 1;
      const effMax = comp.slide ? comp.maxRange : 1;

      for (const v of comp.vectors) {
        let lastReachable: [number, number, number] | null = null;
        let blocked = false;

        for (let s = effMin; s <= effMax; s++) {
          const tx = fx + v[0] * s;
          const ty = fy + v[1] * s;
          const tz = fz + v[2] * s;
          if (!inBounds(tx, ty, tz) || blocked) break;

          const idx = toIndex(tx, ty, tz);
          const occ = this.occupancy[idx];
          if (occ === EMPTY) {
            lastReachable = [tx, ty, tz];
          } else if (!comp.jumps) {
            this.capturable.add(idx);
            blocked = true;
          }
        }

        if (lastReachable) {
          const w = toWorld(lastReachable[0], lastReachable[1], lastReachable[2]);
          this.visuals.add(makeBeam(from.clone(), new THREE.Vector3(w.x, w.y, w.z), '#38e1ff'));
        }
      }
    }
  }

  private drawBlockerCubes(): void {
    for (const b of this.blockers) {
      const [x, y, z] = tuple(b);
      const w = toWorld(x, y, z);
      const geo = new THREE.BoxGeometry(CELL * 0.4, CELL * 0.4, CELL * 0.4);
      const mat = new THREE.MeshBasicMaterial({ color: '#5e82ae', transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(w.x, w.y, w.z);
      this.visuals.add(mesh);
    }
  }

  private clearVisuals(): void {
    for (const child of [...this.visuals.children]) {
      this.visuals.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    }
  }

  private notify(): void {
    this.callbacks.onChange();
  }
}
