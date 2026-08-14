import { N, CELL } from './config';

export const toIndex = (x: number, y: number, z: number): number => x + N * y + N * N * z;
export const xOf = (i: number): number => i % N;
export const yOf = (i: number): number => Math.floor(i / N) % N;
export const zOf = (i: number): number => Math.floor(i / (N * N));

export const inBounds = (x: number, y: number, z: number): boolean =>
  x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N;

export interface WorldPos {
  x: number;
  y: number;
  z: number;
}

// World space, cube centered on origin. Three.js +z faces the viewer, so game-forward is world -z.
export const toWorld = (x: number, y: number, z: number): WorldPos => ({
  x: (x - (N - 1) / 2) * CELL,
  y: (y - (N - 1) / 2) * CELL,
  z: -(z - (N - 1) / 2) * CELL,
});

export const label = (i: number): string => `${xOf(i)}${yOf(i)}${zOf(i)}`;
export const tuple = (i: number): [number, number, number] => [xOf(i), yOf(i), zOf(i)];
