import { createScene } from './render/scene';
import { CameraController } from './render/camera';
import { buildLattice } from './render/lattice';
import { HoverHighlight, GuideLines } from './render/highlights';
import { Picker } from './input/picking';
import { Hud } from './ui/hud';
import { PieceBoard } from './piece/board';
import { xOf, yOf, zOf } from './engine/coords';

const app = document.getElementById('app')!;

const { scene, renderer, canvas } = createScene(app);
const cameraController = new CameraController(canvas);

const lattice = buildLattice();
scene.add(lattice.group);

const hover = new HoverHighlight(lattice.cellMarkers);
const guideLines = new GuideLines();
scene.add(guideLines.group);

const picker = new Picker(canvas, cameraController.camera);

const board = new PieceBoard();
scene.add(board.visuals);

const hud = new Hud(app, {
  onPreset: (preset) => {
    if (preset === '1') cameraController.snapWhite();
    if (preset === '2') cameraController.snapBlack();
    if (preset === '3') cameraController.snapTop();
    if (preset === 'r') cameraController.reset();
  },
});
hud.setPiece(board.getHudState());

canvas.addEventListener('click', (e) => {
  const state = picker.update();
  if (state.index !== null) {
    board.handleClick(state.index, e.shiftKey);
    hud.setPiece(board.getHudState());
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Backspace') {
    board.clear();
    hud.setPiece(board.getHudState());
  }
});

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  cameraController.update(dt);

  const hoverState = picker.update();
  hover.setHover(hoverState.index);
  hud.setHover(hoverState.index, hoverState.depth, hoverState.hitCount);
  if (hoverState.index !== null) {
    guideLines.show(xOf(hoverState.index), yOf(hoverState.index), zOf(hoverState.index));
  } else {
    guideLines.hide();
  }

  hud.tickFps();
  renderer.render(scene, cameraController.camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
