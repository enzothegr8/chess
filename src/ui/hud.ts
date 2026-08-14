import { N } from '../engine/config';
import { label } from '../engine/coords';
import type { PieceHudState } from '../piece/board';

export interface HudCallbacks {
  onPreset: (preset: '1' | '2' | '3' | 'r') => void;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly statusReadout: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private frames = 0;
  private lastFpsUpdate = performance.now();

  constructor(container: HTMLElement, callbacks: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    container.appendChild(this.root);

    this.statusReadout = this.panel('status-readout');
    this.setStatus(null, null, 0, 0, null);

    this.fpsEl = this.panel('fps');
    this.fpsEl.textContent = '-- fps';

    const presets = this.panel('camera-presets');
    const btn = (text: string, handler: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.addEventListener('click', handler);
      presets.appendChild(b);
    };
    btn('Blue [1]', () => callbacks.onPreset('1'));
    btn('Red [2]', () => callbacks.onPreset('2'));
    btn('Top [3]', () => callbacks.onPreset('3'));
    btn('Reset [R]', () => callbacks.onPreset('r'));

    const hint = this.panel('controls-hint');
    hint.innerHTML =
      '<b>Orbit</b> drag &middot; <b>Zoom</b> scroll &middot; <b>Pan</b> shift+drag &middot; <b>Views</b> 1 2 3 &middot; <b>Reset</b> R<br>' +
      '<b>Select</b> click &middot; <b>Move sel.</b> W A S D, &uarr; &darr; &middot; <b>Deselect</b> esc<br>' +
      '<b>Place/move piece</b> enter/space &middot; <b>Blocker</b> shift+click &middot; <b>Clear</b> backspace';
  }

  private panel(id: string): HTMLElement {
    const el = document.createElement('div');
    el.id = id;
    el.className = 'hud-panel';
    this.root.appendChild(el);
    return el;
  }

  private coordRow(labelText: string, index: number | null, suffix = ''): string {
    const value = index === null ? '--' : `(${index % N}, ${Math.floor(index / N) % N}, ${Math.floor(index / (N * N))})  ${label(index)}`;
    return (
      `<div class="status-row"><span class="status-label">${labelText}</span>` +
      `<span class="status-val">${value}</span>${suffix}</div>`
    );
  }

  setStatus(
    hoveredCell: number | null,
    selectedCell: number | null,
    depth: number,
    hitCount: number,
    piece: PieceHudState | null
  ): void {
    const depthSuffix = hitCount > 1 ? `<span class="status-sub">${depth + 1} / ${hitCount}</span>` : '';

    let html = this.coordRow('hovered', hoveredCell, depthSuffix);
    html += this.coordRow('selected', selectedCell);

    const pieceVal = piece ? `${piece.name}  (${piece.cell[0]}, ${piece.cell[1]}, ${piece.cell[2]})` : '--';
    const reachVal = piece ? `${piece.reachable} cells` : '--';
    html +=
      `<div class="status-row"><span class="status-label">piece</span><span class="status-val">${pieceVal}</span></div>` +
      `<div class="status-row"><span class="status-label">reach</span><span class="status-val">${reachVal}</span></div>`;

    this.statusReadout.innerHTML = html;
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
