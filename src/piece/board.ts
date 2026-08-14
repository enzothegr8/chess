import * as THREE from 'three';
import { CELLS, CELL } from '../engine/config';
import { inBounds, toIndex, toWorld, tuple } from '../engine/coords';
import { generateMoves, EMPTY, FRIENDLY, type PieceDef } from '../engine/movement';
import { makeMarker, makeBeam } from '../render/highlights';
import { ROOK } from '../engine/pieces';

export interface PieceHudState {
  name: string;
  cell: [number, number, number];
  reachable: number;
}

/**
 * Owns the single active piece, its blockers, and the always-on visualization
 * of its move set. No selection state beyond "is the piece placed" — the
 * full move set is shown whenever the piece is on the board.
 */
export class PieceBoard {
  readonly visuals = new THREE.Group();

  private readonly def: PieceDef = ROOK;
  private pieceCell: number | null = null;
  private readonly blockers = new Set<number>();

  private readonly occupancy = new Uint8Array(CELLS);
  private readonly moveBuf = new Int32Array(CELLS);

  handleClick(index: number, shiftKey: boolean): void {
    if (shiftKey) {
      if (index === this.pieceCell) return;
      if (this.blockers.has(index)) this.blockers.delete(index);
      else this.blockers.add(index);
      this.render();
      return;
    }

    if (index === this.pieceCell) {
      this.pieceCell = null; // click the piece: deselect (remove it)
    } else {
      this.blockers.delete(index);
      this.pieceCell = index; // place, or move to a new cell
    }
    this.render();
  }

  clear(): void {
    this.pieceCell = null;
    this.blockers.clear();
    this.render();
  }

  getHudState(): PieceHudState | null {
    if (this.pieceCell === null) return null;
    return { name: this.def.name, cell: tuple(this.pieceCell), reachable: this.reachableCount() };
  }

  private reachableCount(): number {
    if (this.pieceCell === null) return 0;
    this.rebuildOccupancy();
    return generateMoves(this.pieceCell, this.def, this.occupancy, this.moveBuf);
  }

  private rebuildOccupancy(): void {
    this.occupancy.fill(EMPTY);
    for (const b of this.blockers) this.occupancy[b] = FRIENDLY;
  }

  private render(): void {
    this.clearVisuals();
    this.drawBlockers();

    if (this.pieceCell === null) return;

    this.rebuildOccupancy();
    const moveCount = generateMoves(this.pieceCell, this.def, this.occupancy, this.moveBuf);
    for (let i = 0; i < moveCount; i++) this.addMarker(this.moveBuf[i], '#38e1ff');

    this.drawRays();
    this.addMarker(this.pieceCell, '#eafeff', 0.3);
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
        let terminal: [number, number, number] | null = null;
        let blocked = false;

        for (let s = effMin; s <= effMax; s++) {
          const tx = fx + v[0] * s;
          const ty = fy + v[1] * s;
          const tz = fz + v[2] * s;
          if (!inBounds(tx, ty, tz) || blocked) break;

          terminal = [tx, ty, tz];
          const occ = this.occupancy[toIndex(tx, ty, tz)];
          if (occ !== EMPTY && !comp.jumps) blocked = true;
        }

        if (!terminal) continue;

        const w = toWorld(terminal[0], terminal[1], terminal[2]);
        this.visuals.add(makeBeam(from.clone(), new THREE.Vector3(w.x, w.y, w.z), '#38e1ff'));

        if (blocked) this.addMarker(toIndex(terminal[0], terminal[1], terminal[2]), '#ff3b6b');
      }
    }
  }

  private drawBlockers(): void {
    for (const b of this.blockers) {
      const [x, y, z] = tuple(b);
      const w = toWorld(x, y, z);
      const geo = new THREE.BoxGeometry(CELL * 0.4, CELL * 0.4, CELL * 0.4);
      const mat = new THREE.MeshBasicMaterial({ color: '#1b3556', transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(w.x, w.y, w.z);
      this.visuals.add(mesh);
    }
  }

  private addMarker(index: number, color: string, scale = 1): void {
    const [x, y, z] = tuple(index);
    const w = toWorld(x, y, z);
    const marker = makeMarker(color);
    marker.position.set(w.x, w.y, w.z);
    marker.rotation.x = Math.PI / 2;
    marker.scale.setScalar(scale);
    this.visuals.add(marker);
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
}
