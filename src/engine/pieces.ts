import { ORTHOGONAL } from './vectors';
import { N } from './config';
import type { PieceDef } from './movement';

export const ROOK: PieceDef = {
  id: 'rook',
  name: 'Rook',
  glyph: 'R',
  components: [
    {
      vectors: ORTHOGONAL,
      slide: true,
      minRange: 1,
      maxRange: N - 1,
      jumps: false,
      moveOnly: false,
      captureOnly: false,
    },
  ],
};

export const PIECES: readonly PieceDef[] = [ROOK];
