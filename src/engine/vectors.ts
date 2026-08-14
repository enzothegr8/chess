export type Vec3 = readonly [number, number, number];

export const ORTHOGONAL: readonly Vec3[] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export const FACE_DIAGONAL: readonly Vec3[] = [
  [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
  [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
];

export const TRIAGONAL: readonly Vec3[] = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
];

/** All distinct signed permutations of |a|, |b|, |c|. leaper(0,1,2) yields 24 vectors. */
export function leaper(a: number, b: number, c: number): Vec3[] {
  const mags = [Math.abs(a), Math.abs(b), Math.abs(c)];
  const seen = new Set<string>();
  const out: Vec3[] = [];

  const permute = (arr: number[]): number[][] => {
    if (arr.length <= 1) return [arr];
    const results: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of permute(rest)) results.push([arr[i], ...p]);
    }
    return results;
  };

  for (const perm of permute(mags)) {
    const [px, py, pz] = perm;
    const sx = [px, -px].filter((v, i, a) => a.indexOf(v) === i);
    const sy = [py, -py].filter((v, i, a) => a.indexOf(v) === i);
    const sz = [pz, -pz].filter((v, i, a) => a.indexOf(v) === i);
    for (const x of sx) for (const y of sy) for (const z of sz) {
      const key = `${x},${y},${z}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push([x, y, z]);
      }
    }
  }
  return out;
}
