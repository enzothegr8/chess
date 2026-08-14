import { N } from '../engine/config';
import { ORTHOGONAL, FACE_DIAGONAL, TRIAGONAL, leaper } from '../engine/vectors';
import type { Vec3 } from '../engine/vectors';
import type { MovementComponent, PieceDef } from '../engine/movement';

export interface LabComponent extends MovementComponent {
  id: string;
  label: string;
}

export type KingMode = 'all26' | 'orthoFace18' | 'faceOnly12' | 'orthoOnly6';

export interface ReadoutData {
  reachable: number;
  attacked: number;
  king: {
    cell: [number, number, number];
    escapeTotal: number;
    escapeCovered: number;
    kingCellAttacked: boolean;
  } | null;
}

export interface LabControlsCallbacks {
  onComponentsChange: (def: PieceDef) => void;
  onKingModeChange: (mode: KingMode) => void;
  onArmKing: () => void;
  onClearBlockers: () => void;
  onSaveSlot: (name: string) => void;
  onLoadSlot: (name: string) => void;
}

let idCounter = 0;
const nextId = () => `comp-${idCounter++}`;

function defaultComponent(vectors: readonly Vec3[], label: string): LabComponent {
  return {
    id: nextId(),
    label,
    vectors,
    slide: true,
    minRange: 1,
    maxRange: N - 1,
    jumps: false,
    moveOnly: false,
    captureOnly: false,
  };
}

export class LabControls {
  readonly panel: HTMLElement;
  private components: LabComponent[] = [];
  private savedSlots: string[] = [];

  private readonly componentListEl: HTMLElement;
  private readonly readoutEl: HTMLElement;
  private readonly slotListEl: HTMLElement;
  private readonly armKingBtn: HTMLButtonElement;

  constructor(container: HTMLElement, private readonly callbacks: LabControlsCallbacks) {
    this.panel = document.createElement('div');
    this.panel.id = 'lab-panel';
    container.appendChild(this.panel);

    this.panel.innerHTML = '<h2>Piece Laboratory</h2>';

    // --- Composer -----------------------------------------------------
    const composer = document.createElement('div');
    this.panel.appendChild(composer);

    const familyRow = document.createElement('div');
    familyRow.innerHTML = '<h3>Composer</h3>';
    composer.appendChild(familyRow);

    const families: Array<{ key: string; vectors: readonly Vec3[]; label: string }> = [
      { key: 'orthogonal', vectors: ORTHOGONAL, label: 'Orthogonal (6)' },
      { key: 'face', vectors: FACE_DIAGONAL, label: 'Face diagonal (12)' },
      { key: 'tri', vectors: TRIAGONAL, label: 'Triagonal (8)' },
    ];
    for (const fam of families) {
      const wrap = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', () => {
        if (cb.checked) {
          this.components.push(defaultComponent(fam.vectors, fam.label));
        } else {
          this.components = this.components.filter((c) => c.label !== fam.label);
        }
        this.renderComponents();
        this.emitChange();
      });
      wrap.appendChild(cb);
      wrap.appendChild(document.createTextNode(fam.label));
      composer.appendChild(wrap);
    }

    // leaper composer
    const leaperRow = document.createElement('div');
    leaperRow.className = 'lab-row';
    leaperRow.style.marginTop = '8px';
    const inputs = ['a', 'b', 'c'].map((name) => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = name === 'c' ? '2' : name === 'b' ? '1' : '0';
      inp.min = '0';
      inp.max = String(N - 1);
      inp.title = name;
      return inp;
    });
    const countSpan = document.createElement('span');
    const updateCount = () => {
      const [a, b, c] = inputs.map((i) => Number(i.value));
      countSpan.textContent = `${leaper(a, b, c).length} vectors`;
    };
    inputs.forEach((i) => i.addEventListener('input', updateCount));
    updateCount();

    const addLeaperBtn = document.createElement('button');
    addLeaperBtn.textContent = 'Add leaper';
    addLeaperBtn.addEventListener('click', () => {
      const [a, b, c] = inputs.map((i) => Number(i.value));
      const vectors = leaper(a, b, c);
      this.components.push({
        id: nextId(),
        label: `Leaper(${a},${b},${c})`,
        vectors,
        slide: false,
        minRange: 1,
        maxRange: 1,
        jumps: true,
        moveOnly: false,
        captureOnly: false,
      });
      this.renderComponents();
      this.emitChange();
    });

    leaperRow.append('leap (', inputs[0], ',', inputs[1], ',', inputs[2], ') ', addLeaperBtn, countSpan);
    composer.appendChild(leaperRow);

    // component list
    const listHeader = document.createElement('h3');
    listHeader.textContent = 'Components';
    this.panel.appendChild(listHeader);
    this.componentListEl = document.createElement('div');
    this.panel.appendChild(this.componentListEl);

    // --- Placement ------------------------------------------------------
    const placeHeader = document.createElement('h3');
    placeHeader.textContent = 'Placement';
    this.panel.appendChild(placeHeader);

    const hint = document.createElement('div');
    hint.style.opacity = '0.7';
    hint.style.marginBottom = '6px';
    hint.textContent = 'Click: place test piece · Shift+Click: toggle blocker';
    this.panel.appendChild(hint);

    const placeRow = document.createElement('div');
    this.armKingBtn = document.createElement('button');
    this.armKingBtn.textContent = 'Place Enemy King (next click)';
    this.armKingBtn.addEventListener('click', () => {
      this.armKingBtn.classList.add('active');
      callbacks.onArmKing();
    });
    const clearBlockersBtn = document.createElement('button');
    clearBlockersBtn.textContent = 'Clear Blockers';
    clearBlockersBtn.addEventListener('click', () => callbacks.onClearBlockers());
    placeRow.append(this.armKingBtn, clearBlockersBtn);
    this.panel.appendChild(placeRow);

    // --- King mobility experiment ---------------------------------------
    const kingHeader = document.createElement('h3');
    kingHeader.textContent = 'King mobility';
    this.panel.appendChild(kingHeader);

    const kingModes: Array<{ mode: KingMode; label: string }> = [
      { mode: 'all26', label: 'All 26' },
      { mode: 'orthoFace18', label: 'Ortho + face (18)' },
      { mode: 'faceOnly12', label: 'Face diagonal only (12)' },
      { mode: 'orthoOnly6', label: 'Orthogonal only (6)' },
    ];
    const kingBtnRow = document.createElement('div');
    const kingBtns: HTMLButtonElement[] = [];
    for (const km of kingModes) {
      const b = document.createElement('button');
      b.textContent = km.label;
      if (km.mode === 'orthoFace18') b.classList.add('active');
      b.addEventListener('click', () => {
        kingBtns.forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        callbacks.onKingModeChange(km.mode);
      });
      kingBtns.push(b);
      kingBtnRow.appendChild(b);
    }
    this.panel.appendChild(kingBtnRow);

    // --- Save/load slots --------------------------------------------------
    const slotHeader = document.createElement('h3');
    slotHeader.textContent = 'Saved pieces';
    this.panel.appendChild(slotHeader);

    const slotRow = document.createElement('div');
    const slotInput = document.createElement('input');
    slotInput.type = 'text';
    slotInput.placeholder = 'name';
    slotInput.style.width = '110px';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const name = slotInput.value.trim();
      if (!name) return;
      if (!this.savedSlots.includes(name)) this.savedSlots.push(name);
      callbacks.onSaveSlot(name);
      this.renderSlots();
    });
    slotRow.append(slotInput, saveBtn);
    this.panel.appendChild(slotRow);

    this.slotListEl = document.createElement('div');
    this.panel.appendChild(this.slotListEl);

    // --- Readouts ---------------------------------------------------------
    const readoutHeader = document.createElement('h3');
    readoutHeader.textContent = 'Readouts';
    this.panel.appendChild(readoutHeader);
    this.readoutEl = document.createElement('div');
    this.readoutEl.className = 'readout-block';
    this.panel.appendChild(this.readoutEl);

    this.renderComponents();
    this.updateReadouts({ reachable: 0, attacked: 0, king: null });
  }

  kingArmedDone(): void {
    this.armKingBtn.classList.remove('active');
  }

  getComponents(): LabComponent[] {
    return this.components;
  }

  private renderSlots(): void {
    this.slotListEl.innerHTML = '';
    for (const name of this.savedSlots) {
      const row = document.createElement('div');
      row.className = 'lab-row';
      const label = document.createElement('span');
      label.textContent = name;
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => this.callbacks.onLoadSlot(name));
      row.append(label, loadBtn);
      this.slotListEl.appendChild(row);
    }
  }

  private renderComponents(): void {
    this.componentListEl.innerHTML = '';
    if (this.components.length === 0) {
      const empty = document.createElement('div');
      empty.style.opacity = '0.6';
      empty.textContent = 'No components. Check a family above.';
      this.componentListEl.appendChild(empty);
      return;
    }

    for (const comp of this.components) {
      const item = document.createElement('div');
      item.className = 'component-item';

      const title = document.createElement('div');
      title.className = 'comp-title';
      title.textContent = `${comp.label} — ${comp.vectors.length} vectors`;
      item.appendChild(title);

      const slideLabel = document.createElement('label');
      const slideCb = document.createElement('input');
      slideCb.type = 'checkbox';
      slideCb.checked = comp.slide;
      slideCb.addEventListener('change', () => {
        comp.slide = slideCb.checked;
        this.renderComponents();
        this.emitChange();
      });
      slideLabel.append(slideCb, 'slide');
      item.appendChild(slideLabel);

      if (comp.slide) {
        const rangeLabel = document.createElement('label');
        rangeLabel.textContent = `maxRange: ${comp.maxRange}`;
        const rangeInput = document.createElement('input');
        rangeInput.type = 'range';
        rangeInput.min = '1';
        rangeInput.max = String(N - 1);
        rangeInput.value = String(comp.maxRange);
        rangeInput.addEventListener('input', () => {
          comp.maxRange = Number(rangeInput.value);
          rangeLabel.textContent = `maxRange: ${comp.maxRange}`;
          this.emitChange();
        });
        item.appendChild(rangeLabel);
        item.appendChild(rangeInput);
      }

      const jumpsLabel = document.createElement('label');
      const jumpsCb = document.createElement('input');
      jumpsCb.type = 'checkbox';
      jumpsCb.checked = comp.jumps;
      jumpsCb.addEventListener('change', () => {
        comp.jumps = jumpsCb.checked;
        this.emitChange();
      });
      jumpsLabel.append(jumpsCb, 'jumps (ignore blockers)');
      item.appendChild(jumpsLabel);

      const moveOnlyLabel = document.createElement('label');
      const moveOnlyCb = document.createElement('input');
      moveOnlyCb.type = 'checkbox';
      moveOnlyCb.checked = comp.moveOnly;
      moveOnlyCb.addEventListener('change', () => {
        comp.moveOnly = moveOnlyCb.checked;
        if (comp.moveOnly) comp.captureOnly = false;
        this.renderComponents();
        this.emitChange();
      });
      moveOnlyLabel.append(moveOnlyCb, 'moveOnly (no capture)');
      item.appendChild(moveOnlyLabel);

      const captureOnlyLabel = document.createElement('label');
      const captureOnlyCb = document.createElement('input');
      captureOnlyCb.type = 'checkbox';
      captureOnlyCb.checked = comp.captureOnly;
      captureOnlyCb.addEventListener('change', () => {
        comp.captureOnly = captureOnlyCb.checked;
        if (comp.captureOnly) comp.moveOnly = false;
        this.renderComponents();
        this.emitChange();
      });
      captureOnlyLabel.append(captureOnlyCb, 'captureOnly');
      item.appendChild(captureOnlyLabel);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        this.components = this.components.filter((c) => c.id !== comp.id);
        this.renderComponents();
        this.emitChange();
      });
      item.appendChild(deleteBtn);

      this.componentListEl.appendChild(item);
    }
  }

  setComponents(components: LabComponent[]): void {
    this.components = components;
    this.renderComponents();
    this.emitChange();
  }

  private emitChange(): void {
    const def: PieceDef = {
      id: 'lab-test-piece',
      name: 'Test Piece',
      glyph: '?',
      components: this.components,
    };
    this.callbacks.onComponentsChange(def);
  }

  updateReadouts(data: ReadoutData): void {
    const pct = ((data.attacked / (N * N * N)) * 100).toFixed(1);
    let html =
      `<div class="readout-line"><span>reachable cells</span><span class="val">${data.reachable}</span></div>` +
      `<div class="readout-line"><span>attacked cells</span><span class="val">${data.attacked}</span></div>` +
      `<div class="readout-line"><span>% of lattice</span><span class="val">${pct}%</span></div>`;

    if (data.king) {
      const k = data.king;
      html +=
        `<div class="readout-line" style="margin-top:8px"><span>king at</span><span class="val">(${k.cell.join(', ')})</span></div>` +
        `<div class="readout-line"><span>king escape cells</span><span class="val">${k.escapeTotal}</span></div>` +
        `<div class="readout-line"><span>escape covered</span><span class="val">${k.escapeCovered} of ${k.escapeTotal}</span></div>` +
        `<div class="readout-line"><span>king cell attacked</span><span class="val${k.kingCellAttacked ? ' alarm' : ''}">${k.kingCellAttacked ? 'yes' : 'no'}</span></div>`;
    }

    this.readoutEl.innerHTML = html;
  }
}
