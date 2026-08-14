import { createScene } from './render/scene';
import { CameraController } from './render/camera';
import { buildLattice } from './render/lattice';
import { HoverHighlight, GuidePlanes } from './render/highlights';
import { Picker } from './input/picking';
import { Hud } from './ui/hud';
import { PieceLab } from './lab/lab';
import { xOf, yOf, zOf } from './engine/coords';

const app = document.getElementById('app')!;

const { scene, renderer, canvas } = createScene(app);
const cameraController = new CameraController(canvas);

const lattice = buildLattice();
scene.add(lattice.group);

const hover = new HoverHighlight(lattice.cellMarkers);
const guidePlanes = new GuidePlanes();
scene.add(guidePlanes.group);

const picker = new Picker(canvas, cameraController.camera, lattice.pickCollider);

let labOpen = false;
const lab = new PieceLab(app);
lab.visuals.visible = false;
scene.add(lab.visuals);

function setLabOpen(open: boolean): void {
  labOpen = open;
  lab.controls.panel.classList.toggle('open', open);
  lab.visuals.visible = open;
}

const hud = new Hud(app, {
  onPreset: (preset) => {
    if (preset === '1') cameraController.snapWhite();
    if (preset === '2') cameraController.snapBlack();
    if (preset === '3') cameraController.snapTop();
    if (preset === 'r') cameraController.reset();
  },
  onLabToggle: () => setLabOpen(!labOpen),
});

canvas.addEventListener('click', (e) => {
  if (!labOpen) return;
  const state = picker.update();
  if (state.index !== null) lab.handleClick(state.index, e.shiftKey);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyL') setLabOpen(!labOpen);
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
    guidePlanes.show(xOf(hoverState.index), yOf(hoverState.index), zOf(hoverState.index));
  } else {
    guidePlanes.hide();
  }

  hud.tickFps();
  renderer.render(scene, cameraController.camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
