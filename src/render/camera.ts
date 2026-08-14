import * as THREE from 'three';
import { N, CELL } from '../engine/config';

const EPS = 0.001;
const DAMP = 10; // higher = snappier, still critically-damped (no overshoot)

function damp(current: number, goal: number, lambda: number, dt: number): number {
  return THREE.MathUtils.lerp(current, goal, 1 - Math.exp(-lambda * dt));
}

interface Preset {
  theta: number;
  phi: number;
  radius: number;
  target: THREE.Vector3;
}

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  // goal state (what input drives)
  private theta = 0;
  private phi = THREE.MathUtils.degToRad(58);
  private radius = N * CELL * 1.9;
  private target = new THREE.Vector3(0, 0, 0);

  // smoothed state (what actually gets rendered)
  private curTheta = this.theta;
  private curPhi = this.phi;
  private curRadius = this.radius;
  private curTarget = this.target.clone();

  private keys = new Set<string>();
  private dragging: 'none' | 'orbit' | 'pan' = 'none';
  private lastX = 0;
  private lastY = 0;

  private readonly defaultPreset: Preset;

  constructor(domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    this.defaultPreset = {
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      target: this.target.clone(),
    };
    this.resize(domElement.clientWidth, domElement.clientHeight);
    this.bind(domElement);
    this.applyImmediate();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  private bind(el: HTMLElement): void {
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.dragging = 'pan';
      } else if (e.button === 0) {
        this.dragging = 'orbit';
      }
    });

    el.addEventListener('pointerup', (e) => {
      el.releasePointerCapture(e.pointerId);
      this.dragging = 'none';
    });

    el.addEventListener('pointermove', (e) => {
      if (this.dragging === 'none') return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      if (this.dragging === 'orbit') {
        this.theta -= dx * 0.006;
        this.phi = THREE.MathUtils.clamp(this.phi - dy * 0.006, EPS, Math.PI - EPS);
      } else if (this.dragging === 'pan') {
        const panScale = this.radius * 0.0012;
        const right = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2, this.theta + Math.PI / 2);
        const up = new THREE.Vector3(0, 1, 0);
        this.target.addScaledVector(right, -dx * panScale);
        this.target.addScaledVector(up, dy * panScale);
      }
    });

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.radius = THREE.MathUtils.clamp(this.radius * (1 + e.deltaY * 0.001), 1.5, 200);
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Digit1') this.snapWhite();
      if (e.code === 'Digit2') this.snapBlack();
      if (e.code === 'Digit3') this.snapTop();
      if (e.code === 'KeyR') this.reset();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  private snap(theta: number, phi: number): void {
    this.theta = theta;
    this.phi = phi;
    this.radius = this.defaultPreset.radius;
    this.target.copy(this.defaultPreset.target);
  }

  snapWhite(): void {
    this.snap(0, THREE.MathUtils.degToRad(58));
  }

  snapBlack(): void {
    this.snap(Math.PI, THREE.MathUtils.degToRad(58));
  }

  snapTop(): void {
    this.snap(0, THREE.MathUtils.degToRad(2));
  }

  reset(): void {
    this.theta = this.defaultPreset.theta;
    this.phi = this.defaultPreset.phi;
    this.radius = this.defaultPreset.radius;
    this.target.copy(this.defaultPreset.target);
  }

  private applyImmediate(): void {
    this.curTheta = this.theta;
    this.curPhi = this.phi;
    this.curRadius = this.radius;
    this.curTarget.copy(this.target);
    this.updateCameraMatrix();
  }

  private updateCameraMatrix(): void {
    const offset = new THREE.Vector3().setFromSphericalCoords(this.curRadius, this.curPhi, this.curTheta);
    this.camera.position.copy(this.curTarget).add(offset);
    this.camera.lookAt(this.curTarget);
  }

  update(dt: number): void {
    // fly mode: WASD/QE translate the orbit target through space
    const flySpeed = N * CELL * 0.9;
    const forward = new THREE.Vector3().setFromSphericalCoords(1, this.phi, this.theta).multiplyScalar(-1);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.add(forward);
    if (this.keys.has('KeyS')) move.sub(forward);
    if (this.keys.has('KeyD')) move.add(right);
    if (this.keys.has('KeyA')) move.sub(right);
    if (this.keys.has('KeyE')) move.y += 1;
    if (this.keys.has('KeyQ')) move.y -= 1;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(flySpeed * dt);
      this.target.add(move);
    }

    this.curTheta = damp(this.curTheta, this.theta, DAMP, dt);
    this.curPhi = damp(this.curPhi, this.phi, DAMP, dt);
    this.curRadius = damp(this.curRadius, this.radius, DAMP, dt);
    this.curTarget.x = damp(this.curTarget.x, this.target.x, DAMP, dt);
    this.curTarget.y = damp(this.curTarget.y, this.target.y, DAMP, dt);
    this.curTarget.z = damp(this.curTarget.z, this.target.z, DAMP, dt);

    this.updateCameraMatrix();
  }
}
