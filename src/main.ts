import { createScene } from './render/scene';
import { CameraController } from './render/camera';
import { buildLattice } from './render/lattice';
import { GuideLines } from './render/highlights';
import { NodeField } from './render/nodes';
import { buildCellPositions } from './render/cellPositions';
import { Picker } from './input/picking';
import { Hud } from './ui/hud';
import { PieceBoard } from './piece/board';
import { inBounds, toIndex, tuple, xOf, yOf, zOf } from './engine/coords';

const app = document.getElementById('app')!;

const { scene, renderer, canvas } = createScene(app);
const cameraController = new CameraController(canvas);

scene.add(buildLattice());

const positions = buildCellPositions();
const nodeField = new NodeField(positions);
scene.add(nodeField.group);

const guideLines = new GuideLines();
scene.add(guideLines.group);

// Two independent cell references: hoveredCell is transient and follows the
// pointer; selectedCell persists until another click or Escape. They may
// coincide, differ, or either may be null — neither drives the other.
let hoveredCell: number | null = null;
let selectedCell: number | null = null;
let depthInfo = { depth: 0, hitCount: 0 };

const hud = new Hud(app, {
  onPreset: (preset) => {
    if (preset === '1') cameraController.snapWhite();
    if (preset === '2') cameraController.snapBlack();
    if (preset === '3') cameraController.snapTop();
    if (preset === 'r') cameraController.reset();
  },
});

const board = new PieceBoard({
  onChange: () => {
    nodeField.setBoardState(board.reachable, board.capturable, board.getPieceCell());
    updateHud();
  },
});
scene.add(board.visuals);

function updateHud(): void {
  hud.setStatus(hoveredCell, selectedCell, depthInfo.depth, depthInfo.hitCount, board.getHudState());
}

function setSelected(index: number | null): void {
  selectedCell = index;
  nodeField.setSelectedCell(index);
  if (index !== null) guideLines.show(xOf(index), yOf(index), zOf(index));
  else guideLines.hide();
  updateHud();
}

new Picker(canvas, cameraController.camera, positions, (state) => {
  depthInfo = { depth: state.depth, hitCount: state.hitCount };
  hoveredCell = state.index;
  nodeField.setHoveredCell(hoveredCell);
  updateHud();
});

function isTextInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

// Picking is never filtered: hoveredCell always reflects the nearest node to
// the cursor across all N^3 cells, regardless of reachability or any other
// display state, so a click here can select any node at any time.
canvas.addEventListener('click', (e) => {
  if (hoveredCell === null) return;

  if (e.shiftKey) {
    board.toggleBlocker(hoveredCell);
    return;
  }

  setSelected(selectedCell === hoveredCell ? null : hoveredCell);
});

const NAV_DELTA: Record<string, [number, number, number]> = {
  KeyW: [0, 0, 1],
  KeyS: [0, 0, -1],
  KeyA: [-1, 0, 0],
  KeyD: [1, 0, 0],
  ArrowUp: [0, 1, 0],
  ArrowDown: [0, -1, 0],
};

window.addEventListener('keydown', (e) => {
  if (isTextInputFocused()) return;

  if (e.code === 'Escape') {
    setSelected(null);
    return;
  }

  if (e.code === 'Backspace') {
    board.clear();
    return;
  }

  if (e.code in NAV_DELTA) {
    e.preventDefault();
    if (selectedCell === null) return; // keys act on the selection only, never implicitly

    const [dx, dy, dz] = NAV_DELTA[e.code];
    const [bx, by, bz] = tuple(selectedCell);
    const nx = bx + dx;
    const ny = by + dy;
    const nz = bz + dz;
    if (!inBounds(nx, ny, nz)) return; // clamp at the lattice bounds, no wrap
    setSelected(toIndex(nx, ny, nz));
    return;
  }

  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    if (selectedCell !== null) board.activateCell(selectedCell);
  }
});

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  cameraController.update(dt);
  nodeField.update(cameraController.camera);
  hud.tickFps();
  renderer.render(scene, cameraController.camera);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
