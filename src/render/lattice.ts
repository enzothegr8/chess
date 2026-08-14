import * as THREE from 'three';
import { N, CELL, CELLS } from '../engine/config';
import { toWorld } from '../engine/coords';

export interface LatticeBundle {
  group: THREE.Group;
  cellMarkers: THREE.InstancedMesh;
}

function makeTextSprite(text: string, color: string, sizePx = 48): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `600 ${sizePx * 0.62}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, sizePx / 2, sizePx / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(CELL * 0.32, CELL * 0.32, 1);
  return sprite;
}

function buildBoundingCube(): THREE.Group {
  const group = new THREE.Group();
  const half = (N * CELL) / 2;

  const boxGeo = new THREE.BoxGeometry(N * CELL, N * CELL, N * CELL);
  const edges = new THREE.EdgesGeometry(boxGeo);
  const wireMat = new THREE.LineBasicMaterial({ color: '#38e1ff', transparent: true, opacity: 0.35 });
  group.add(new THREE.LineSegments(edges, wireMat));

  // corner brackets: targeting-reticle overshoot at each of the 8 corners
  const bracketLen = half * 0.16;
  const overshoot = half * 0.05;
  const positions: number[] = [];

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = new THREE.Vector3(sx * half, sy * half, sz * half);
        const axes: Array<[number, number, number]> = [
          [-sx, 0, 0],
          [0, -sy, 0],
          [0, 0, -sz],
        ];
        for (const [ax, ay, az] of axes) {
          const dir = new THREE.Vector3(ax, ay, az);
          const outer = corner.clone().addScaledVector(dir, -overshoot);
          const inner = corner.clone().addScaledVector(dir, bracketLen);
          positions.push(outer.x, outer.y, outer.z, inner.x, inner.y, inner.z);
        }
      }
    }
  }

  const bracketGeo = new THREE.BufferGeometry();
  bracketGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const bracketMat = new THREE.LineBasicMaterial({ color: '#38e1ff', transparent: true, opacity: 0.95 });
  group.add(new THREE.LineSegments(bracketGeo, bracketMat));

  return group;
}

function buildCellMarkers(): THREE.InstancedMesh {
  const geometry = new THREE.OctahedronGeometry(CELL * 0.05, 0);
  const material = new THREE.MeshBasicMaterial({ color: '#1b3556' });
  const mesh = new THREE.InstancedMesh(geometry, material, CELLS);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < CELLS; i++) {
    const x = i % N;
    const y = Math.floor(i / N) % N;
    const z = Math.floor(i / (N * N));
    const w = toWorld(x, y, z);
    dummy.position.set(w.x, w.y, w.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function buildAxisRuler(axis: 'x' | 'y' | 'z', color: string): THREE.Group {
  const group = new THREE.Group();
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < N; i++) {
    const w =
      axis === 'x' ? toWorld(i, 0, 0) : axis === 'y' ? toWorld(0, i, 0) : toWorld(0, 0, i);
    points.push(new THREE.Vector3(w.x, w.y, w.z));
  }

  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
  group.add(new THREE.Line(lineGeo, lineMat));

  for (let i = 0; i < N; i++) {
    const label = makeTextSprite(String(i), color);
    label.position.copy(points[i]);
    label.position.y -= axis === 'y' ? 0 : CELL * 0.28;
    if (axis === 'y') label.position.x -= CELL * 0.28;
    group.add(label);
  }

  const glyph = makeTextSprite(axis, color, 64);
  glyph.scale.set(CELL * 0.42, CELL * 0.42, 1);
  glyph.position.copy(points[N - 1]);
  const extra = points[N - 1].clone().sub(points[N - 2]).multiplyScalar(1.4);
  glyph.position.add(extra);
  group.add(glyph);

  return group;
}

export function buildLattice(): LatticeBundle {
  const group = new THREE.Group();

  group.add(buildBoundingCube());
  group.add(buildAxisRuler('x', '#38e1ff'));
  group.add(buildAxisRuler('y', '#eafeff'));
  group.add(buildAxisRuler('z', '#ffb13d'));

  const cellMarkers = buildCellMarkers();
  group.add(cellMarkers);

  return { group, cellMarkers };
}
