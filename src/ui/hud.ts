import { N } from '../engine/config';
import { label } from '../engine/coords';
import type { PieceHudState } from '../piece/board';

export interface HudCallbacks {
  onPreset: (preset: '1' | '2' | '3' | 'r') => void;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly hoverReadout: HTMLElement;
  private readonly pieceReadout: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private frames = 0;
  private lastFpsUpdate = performance.now();

  constructor(container: HTMLElement, callbacks: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    container.appendChild(this.root);

    this.hoverReadout = this.panel('hover-readout');
    this.hoverReadout.innerHTML = this.hoverHtml(null, 0, 0);

    this.pieceReadout = this.panel('piece-readout');
    this.pieceReadout.innerHTML = this.pieceHtml(null);

    this.fpsEl = this.panel('fps');
    this.fpsEl.textContent = '-- fps';

    const presets = this.panel('camera-presets');
    const btn = (text: string, handler: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.addEventListener('click', handler);
      presets.appendChild(b);
    };
    btn('White [1]', () => callbacks.onPreset('1'));
    btn('Black [2]', () => callbacks.onPreset('2'));
    btn('Top [3]', () => callbacks.onPreset('3'));
    btn('Reset [R]', () => callbacks.onPreset('r'));

    const hint = this.panel('controls-hint');
    hint.innerHTML =
      '<b>Orbit</b> drag &middot; <b>Zoom</b> scroll &middot; <b>Pan</b> shift+drag<br>' +
      '<b>Fly</b> WASD QE &middot; <b>Views</b> 1 2 3 &middot; <b>Reset</b> R<br>' +
      '<b>Place/move</b> click &middot; <b>Blocker</b> shift+click &middot; <b>Clear</b> backspace';
  }

  private panel(id: string): HTMLElement {
    const el = document.createElement('div');
    el.id = id;
    el.className = 'hud-panel';
    this.root.appendChild(el);
    return el;
  }

  private hoverHtml(index: number | null, depth: number, hitCount: number): string {
    if (index === null) {
      return '<div class="title">Hover</div><div class="coord">--</div>';
    }
    const x = index % N;
    const y = Math.floor(index / N) % N;
    const z = Math.floor(index / (N * N));
    let html =
      '<div class="title">Hover</div>' +
      `<div class="coord">(${x}, ${y}, ${z})  &middot;  ${label(index)}</div>`;
    if (hitCount > 1) html += `<div>${depth + 1} / ${hitCount}</div>`;
    return html;
  }

  private pieceHtml(state: PieceHudState | null): string {
    if (!state) return '<div class="title">Piece</div><div class="coord">--</div>';
    const [x, y, z] = state.cell;
    return (
      '<div class="title">Piece</div>' +
      `<div class="coord">${state.name}  (${x}, ${y}, ${z})</div>` +
      `<div>reach  ${state.reachable} cells</div>`
    );
  }

  setHover(index: number | null, depth: number, hitCount: number): void {
    this.hoverReadout.innerHTML = this.hoverHtml(index, depth, hitCount);
  }

  setPiece(state: PieceHudState | null): void {
    this.pieceReadout.innerHTML = this.pieceHtml(state);
  }

  tickFps(): void {
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 500) {
      const fps = Math.round((this.frames * 1000) / (now - this.lastFpsUpdate));
      this.fpsEl.textContent = `${fps} fps`;
      this.frames = 0;
      this.lastFpsUpdate = now;
    }
  }
}
