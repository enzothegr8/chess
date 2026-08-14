import { N } from '../engine/config';
import { label } from '../engine/coords';

export interface HudCallbacks {
  onPreset: (preset: '1' | '2' | '3' | 'r') => void;
  onLabToggle: () => void;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly hoverReadout: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private frames = 0;
  private lastFpsUpdate = performance.now();

  constructor(container: HTMLElement, callbacks: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    container.appendChild(this.root);

    this.hoverReadout = this.panel('hover-readout');
    this.hoverReadout.innerHTML = this.hoverHtml(null, 0, 0);

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
      '<b>Fly</b> WASD QE &middot; <b>Depth</b> Alt+scroll or [ ]<br>' +
      '<b>Views</b> 1 2 3 &middot; <b>Reset</b> R';

    const labToggle = document.createElement('button');
    labToggle.id = 'lab-toggle';
    labToggle.className = 'hud-panel';
    labToggle.textContent = 'Piece Lab [L]';
    labToggle.addEventListener('click', () => callbacks.onLabToggle());
    this.root.appendChild(labToggle);
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
      return '<div class="title">Hover</div><div class="coord">--</div><div>depth --/--</div>';
    }
    const x = index % N;
    const y = Math.floor(index / N) % N;
    const z = Math.floor(index / (N * N));
    return (
      '<div class="title">Hover</div>' +
      `<div class="coord">(${x}, ${y}, ${z})  &middot;  ${label(index)}</div>` +
      `<div>depth ${depth + 1} / ${hitCount}</div>`
    );
  }

  setHover(index: number | null, depth: number, hitCount: number): void {
    this.hoverReadout.innerHTML = this.hoverHtml(index, depth, hitCount);
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
