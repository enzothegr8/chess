import * as THREE from 'three';
import { CELLS } from '../engine/config';
import { inBounds, toIndex, toWorld, tuple } from '../engine/coords';
import { ORTHOGONAL, FACE_DIAGONAL, TRIAGONAL } from '../engine/vectors';
import type { Vec3 } from '../engine/vectors';
import { generateMoves, generateAttacks, EMPTY, FRIENDLY, ENEMY, type PieceDef } from '../engine/movement';
import { makeMarker, makeBeam, makeArc } from '../render/highlights';
import { LabControls, type KingMode, type LabComponent, type ReadoutData } from './controls';

const KING_VECTORS: Record<KingMode, readonly Vec3[]> = {
  all26: [...ORTHOGONAL, ...FACE_DIAGONAL, ...TRIAGONAL],
  orthoFace18: [...ORTHOGONAL, ...FACE_DIAGONAL],
  faceOnly12: FACE_DIAGONAL,
  orthoOnly6: ORTHOGONAL,
};

export class PieceLab {
  readonly controls: LabControls;
  readonly visuals = new THREE.Group();

  private def: PieceDef = { id: 'lab-test-piece', name: 'Test Piece', glyph: '?', components: [] };
  private testPieceCell: number | null = null;
  private blockers = new Set<number>();
  private enemyKingCell: number | null = null;
  private kingMode: KingMode = 'orthoFace18';
  private kingArmed = false;

  private readonly occupancy = new Uint8Array(CELLS);
  private readonly moveBuf = new Int32Array(CELLS);
  private readonly attackBuf = new Int32Array(CELLS);
  private readonly savedSlots = new Map<string, LabComponent[]>();

  constructor(container: HTMLElement) {
    this.controls = new LabControls(container, {
      onComponentsChange: (def) => {
        this.def = def;
        this.recompute();
      },
      onKingModeChange: (mode) => {
        this.kingMode = mode;
        this.recompute();
      },
      onArmKing: () => {
        this.kingArmed = true;
      },
      onClearBlockers: () => {
        this.blockers.clear();
        this.recompute();
      },
      onSaveSlot: (name) => {
        this.savedSlots.set(name, this.controls.getComponents().map((c) => ({ ...c })));
      },
      onLoadSlot: (name) => {
        const saved = this.savedSlots.get(name);
        if (saved) this.controls.setComponents(saved.map((c) => ({ ...c })));
      },
    });
  }

  handleClick(index: number, shiftKey: boolean): void {
    if (shiftKey) {
      if (this.blockers.has(index)) this.blockers.delete(index);
      else if (index !== this.testPieceCell && index !== this.enemyKingCell) this.blockers.add(index);
      this.recompute();
      return;
    }

    if (this.kingArmed) {
      this.enemyKingCell = index;
      this.blockers.delete(index);
      this.kingArmed = false;
      this.controls.kingArmedDone();
      this.recompute();
      return;
    }

    this.testPieceCell = index;
    this.blockers.delete(index);
    this.recompute();
  }

  private rebuildOccupancy(): void {
    this.occupancy.fill(EMPTY);
    for (const b of this.blockers) this.occupancy[b] = FRIENDLY;
    if (this.enemyKingCell !== null) this.occupancy[this.enemyKingCell] = ENEMY;
  }

  private recompute(): void {
    this.rebuildOccupancy();
    this.clearVisuals();

    if (this.testPieceCell === null) {
      this.drawBlockersAndKing();
      this.controls.updateReadouts({ reachable: 0, attacked: 0, king: null });
      return;
    }

    const moveCount = generateMoves(this.testPieceCell, this.def, this.occupancy, this.moveBuf);
    const attackCount = generateAttacks(this.testPieceCell, this.def, this.occupancy, this.attackBuf);
    const attackedSet = new Set<number>();
    for (let i = 0; i < attackCount; i++) attackedSet.add(this.attackBuf[i]);
    const reachableSet = new Set<number>();
    for (let i = 0; i < moveCount; i++) reachableSet.add(this.moveBuf[i]);

    for (const idx of reachableSet) this.addMarker(idx, '#38e1ff');
    for (const idx of attackedSet) if (!reachableSet.has(idx)) this.addMarker(idx, '#ff3b6b');

    this.drawRays();
    this.drawBlockersAndKing();
    this.addMarker(this.testPieceCell, '#eafeff', 0.24);

    let king: ReadoutData['king'] = null;

    if (this.enemyKingCell !== null) {
      const [kx, ky, kz] = tuple(this.enemyKingCell);
      const vectors = KING_VECTORS[this.kingMode];
      let escapeTotal = 0;
      let escapeCovered = 0;
      for (const v of vectors) {
        const tx = kx + v[0];
        const ty = ky + v[1];
        const tz = kz + v[2];
        if (!inBounds(tx, ty, tz)) continue;
        escapeTotal++;
        if (attackedSet.has(toIndex(tx, ty, tz))) escapeCovered++;
      }
      king = {
        cell: [kx, ky, kz],
        escapeTotal,
        escapeCovered,
        kingCellAttacked: attackedSet.has(this.enemyKingCell),
      };
    }

    this.controls.updateReadouts({ reachable: reachableSet.size, attacked: attackedSet.size, king });
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

  private drawBlockersAndKing(): void {
    for (const b of this.blockers) {
      const [x, y, z] = tuple(b);
      const w = toWorld(x, y, z);
      const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const mat = new THREE.MeshBasicMaterial({ color: '#1b3556', transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(w.x, w.y, w.z);
      this.visuals.add(mesh);
    }

    if (this.enemyKingCell !== null) {
      const [x, y, z] = tuple(this.enemyKingCell);
      const w = toWorld(x, y, z);
      const geo = new THREE.OctahedronGeometry(0.28, 0);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: '#ffb13d' })
      );
      wire.position.set(w.x, w.y, w.z);
      this.visuals.add(wire);
    }
  }

  private drawRays(): void {
    if (this.testPieceCell === null) return;
    const [fx, fy, fz] = tuple(this.testPieceCell);
    const fromW = toWorld(fx, fy, fz);
    const from = new THREE.Vector3(fromW.x, fromW.y, fromW.z);

    for (const comp of this.def.components) {
      const effMin = comp.slide ? comp.minRange : 1;
      const effMax = comp.slide ? comp.maxRange : 1;

      for (const v of comp.vectors) {
        if (comp.slide) {
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
          if (terminal) {
            const w = toWorld(terminal[0], terminal[1], terminal[2]);
            const beam = makeBeam(from.clone(), new THREE.Vector3(w.x, w.y, w.z), '#38e1ff');
            this.visuals.add(beam);
          }
        } else {
          const tx = fx + v[0];
          const ty = fy + v[1];
          const tz = fz + v[2];
          if (!inBounds(tx, ty, tz)) continue;
          const w = toWorld(tx, ty, tz);
          const arc = makeArc(from.clone(), new THREE.Vector3(w.x, w.y, w.z), '#38e1ff');
          this.visuals.add(arc);
        }
      }
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

  refresh(): void {
    this.recompute();
  }
}
