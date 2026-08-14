// Not named `Color` — that collides with THREE.Color and causes confusing import errors.
export const SIDE = { Blue: 0, Red: 1 } as const;
export type Side = (typeof SIDE)[keyof typeof SIDE];
export const other = (s: Side): Side => (s === SIDE.Blue ? SIDE.Red : SIDE.Blue);
