import { CELLS } from '../engine/config';
import { toWorld, xOf, yOf, zOf } from '../engine/coords';

/** World-space center of every cell, flattened as [x0,y0,z0, x1,y1,z1, ...]. Shared by picking and node rendering. */
export function buildCellPositions(): Float32Array {
  const positions = new Float32Array(CELLS * 3);
  for (let i = 0; i < CELLS; i++) {
    const w = toWorld(xOf(i), yOf(i), zOf(i));
    positions[i * 3] = w.x;
    positions[i * 3 + 1] = w.y;
    positions[i * 3 + 2] = w.z;
  }
  return positions;
}
