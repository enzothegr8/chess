import { N } from './config';
import { inBounds, toIndex } from './coords';
import type { Vec3 } from './vectors';

export interface MovementComponent {
  vectors: readonly Vec3[];
  slide: boolean; // true: ride the ray until blocked. false: single application of the vector.
  minRange: number; // default 1
  maxRange: number; // default N-1 when sliding, 1 when stepping
  jumps: boolean; // true: ignores blockers along the path (leapers)
  moveOnly: boolean; // cannot capture on these vectors (pawn-push behavior)
  captureOnly: boolean; // can only be used to capture (pawn-attack behavior)
}

export interface PieceDef {
  id: string;
  name: string;
  glyph: string;
  components: MovementComponent[];
}

export const EMPTY = 0;
export const FRIENDLY = 1;
export const ENEMY = 2;

type Mode = 'move' | 'attack';

function walk(from: number, def: PieceDef, occupancy: Uint8Array, out: Int32Array, mode: Mode): number {
  const fx = from % N;
  const fy = Math.floor(from / N) % N;
  const fz = Math.floor(from / (N * N));

  let count = 0;

  for (let c = 0; c < def.components.length; c++) {
    const comp = def.components[c];
    const effMin = comp.slide ? comp.minRange : 1;
    const effMax = comp.slide ? comp.maxRange : 1;

    for (let vi = 0; vi < comp.vectors.length; vi++) {
      const v = comp.vectors[vi];
      let blocked = false;

      for (let s = effMin; s <= effMax; s++) {
        const tx = fx + v[0] * s;
        const ty = fy + v[1] * s;
        const tz = fz + v[2] * s;

        if (!inBounds(tx, ty, tz)) break;
        if (blocked) break;

        const idx = toIndex(tx, ty, tz);
        const occ = occupancy[idx];

        if (mode === 'move') {
          if (comp.captureOnly) {
            if (occ === ENEMY) out[count++] = idx;
          } else if (comp.moveOnly) {
            if (occ === EMPTY) out[count++] = idx;
          } else {
            if (occ === EMPTY || occ === ENEMY) out[count++] = idx;
          }
        } else {
          // attack mode: moveOnly vectors never attack; captureOnly/normal attack any
          // cell not held by a friendly piece (hypothetical enemy-king-there test).
          if (!comp.moveOnly && occ !== FRIENDLY) out[count++] = idx;
        }

        if (occ !== EMPTY && !comp.jumps) blocked = true;
      }
    }
  }

  return count;
}

/**
 * Writes reachable cell indices into `out`, returns the count.
 * Allocates nothing. `occupancy` is a Uint8Array(CELLS): 0 empty, 1 friendly, 2 enemy.
 */
export function generateMoves(from: number, def: PieceDef, occupancy: Uint8Array, out: Int32Array): number {
  return walk(from, def, occupancy, out, 'move');
}

/** Same, but returns cells the piece ATTACKS, which differs for moveOnly/captureOnly components. */
export function generateAttacks(from: number, def: PieceDef, occupancy: Uint8Array, out: Int32Array): number {
  return walk(from, def, occupancy, out, 'attack');
}
