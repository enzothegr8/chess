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
    if (preset === '1') cameraController.snapBlue();
    if (preset === '2') cameraController.snapRed();
    if (preset === '3') cameraController.snapTop();
    if (preset === 'r') cameraController.reset();
  },
});

const board = new PieceBoard({
  onChange: () => {
    nodeField.setPieceSide(board.getPieceSide());
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

// A click is a press and release on the same node with negligible movement
// between them; anything else is a drag. Selection (and blocker toggling)
// must never fire on a drag release, so both are decided here from pointer
// deltas rather than from the 'click' event, which knows nothing about
// movement. This also drives the camera: orbit/pan only start once the
// drag threshold is crossed, so a slightly shaky click never nudges it.
const MOUSE_DRAG_THRESHOLD = 5;
const TOUCH_DRAG_THRESHOLD = 10;

let downX = 0;
let downY = 0;
let downButton = -1;
let downCell: number | null = null;
let downShift = false;
let dragged = false;
let dragThresholdSq = MOUSE_DRAG_THRESHOLD * MOUSE_DRAG_THRESHOLD;
let dragMode: 'none' | 'orbit' | 'pan' = 'none';
let lastX = 0;
let lastY = 0;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  downX = e.clientX;
  downY = e.clientY;
  lastX = downX;
  lastY = downY;
  downButton = e.button;
  downCell = hoveredCell;
  downShift = e.shiftKey;
  dragged = false;
  const threshold = e.pointerType === 'touch' ? TOUCH_DRAG_THRESHOLD : MOUSE_DRAG_THRESHOLD;
  dragThresholdSq = threshold * threshold;

  if (e.button === 1 || (e.button === 0 && e.shiftKey)) dragMode = 'pan';
  else if (e.button === 0) dragMode = 'orbit';
  else dragMode = 'none';
});

canvas.addEventListener('pointermove', (e) => {
  if (downButton === -1) return;

  if (!dragged) {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (dx * dx + dy * dy > dragThresholdSq) dragged = true;
  }

  if (dragged && dragMode !== 'none') {
    const ddx = e.clientX - lastX;
    const ddy = e.clientY - lastY;
    if (dragMode === 'orbit') cameraController.orbit(ddx, ddy);
    else cameraController.pan(ddx, ddy);
  }
  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener('pointerup', (e) => {
  canvas.releasePointerCapture(e.pointerId);

  if (downButton === 0 && !dragged && hoveredCell !== null && hoveredCell === downCell) {
    if (downShift) board.toggleBlocker(hoveredCell);
    else setSelected(selectedCell === hoveredCell ? null : hoveredCell);
  }

  downButton = -1;
  dragMode = 'none';
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
