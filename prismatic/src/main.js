import { vec } from './geometry.js';
import { makeElement, SOURCE_KINDS } from './elements.js';
import { MATERIALS, refractiveIndex } from './optics.js';
import { trace } from './tracer.js';
import { elementAt, onHandle } from './picking.js';
import { PARAMS, LABELS, applyParam, hasMaterial } from './params.js';
import { drawGrid, drawRays, drawElement, drawSelection } from './render.js';
import { wavelengthToCss } from './spectrum.js';

const canvas = document.getElementById('bench');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const inspectorTitle = document.getElementById('inspector-title');
const inspectorBody = document.getElementById('inspector-body');
const gainInput = document.getElementById('gain');
const gainValue = document.getElementById('gain-value');
const showFaint = document.getElementById('show-faint');
const showGrid = document.getElementById('show-grid');

const state = {
  elements: [],
  selected: null,
  drag: null,
  result: { segments: [], stats: null },
  dirty: true,
  width: 0,
  height: 0,
};

function defaultBench(w, h) {
  const cx = w / 2;
  const cy = h / 2;
  return [
    makeElement('beam', cx - 0.4 * w, cy - 0.18 * h, 0, { width: 70, count: 9 }),
    makeElement('convexLens', cx - 0.12 * w, cy - 0.18 * h),
    makeElement('laser', cx - 0.4 * w, cy + 0.22 * h, -0.12, { wavelength: 635 }),
    makeElement('prism', cx + 0.02 * w, cy + 0.16 * h, 0, { side: 150 }),
    makeElement('curvedMirror', cx + 0.4 * w, cy - 0.1 * h, Math.PI, { radius: 360, aperture: 110 }),
  ];
}

function selectedElement() {
  return state.elements.find((el) => el.id === state.selected) || null;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.width = rect.width;
  state.height = rect.height;
  state.dirty = true;
}

function render() {
  if (state.dirty) {
    state.result = trace(state.elements);
    state.dirty = false;
    updateStatus();
  }
  const { width: w, height: h } = state;
  ctx.fillStyle = '#07080b';
  ctx.fillRect(0, 0, w, h);
  if (showGrid.checked) drawGrid(ctx, w, h);
  const gain = Number(gainInput.value);
  drawRays(ctx, state.result.segments, { gain, floor: showFaint.checked ? 0 : 0.08 });
  for (const el of state.elements) drawElement(ctx, el);
  const sel = selectedElement();
  if (sel) drawSelection(ctx, sel);
}

function frame() {
  render();
  requestAnimationFrame(frame);
}

function updateStatus() {
  const { segments, stats } = state.result;
  const sources = state.elements.filter((el) => SOURCE_KINDS.has(el.kind)).length;
  if (!sources) {
    statusEl.textContent = 'Add a light source to start tracing.';
    return;
  }
  const parts = [`${stats.launched} rays from ${sources} source${sources === 1 ? '' : 's'}`, `${segments.length} path segments`];
  if (stats.truncated) parts.push('segment limit reached');
  statusEl.textContent = parts.join(' · ');
}

// Inspector ----------------------------------------------------------------

function fmt(value, spec) {
  return `${Math.round(value * 10) / 10}${spec.unit ? ` ${spec.unit}` : ''}`;
}

function rangeControl(el, spec, value, onInput) {
  const wrap = document.createElement('div');
  wrap.className = 'param';
  const id = `param-${spec.key}`;
  const head = document.createElement('div');
  head.className = 'param-head';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = spec.label;
  const out = document.createElement('output');
  out.htmlFor = id;
  out.textContent = fmt(value, spec);
  head.append(label, out);
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  Object.assign(input, { min: spec.min, max: spec.max, step: spec.step, value });
  input.addEventListener('input', () => {
    onInput(input.value);
    out.textContent = fmt(Number(input.value), spec);
  });
  wrap.append(head, input);
  return wrap;
}

function buildInspector() {
  const el = selectedElement();
  inspectorBody.replaceChildren();
  if (!el) {
    inspectorTitle.textContent = 'Nothing selected';
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Select an element on the bench to edit it.';
    inspectorBody.append(p);
    return;
  }
  inspectorTitle.textContent = LABELS[el.kind];

  const angleSpec = { key: 'angle', label: 'Angle', min: -180, max: 180, step: 1, unit: '°' };
  const deg = ((((el.angle * 180) / Math.PI + 180) % 360) + 360) % 360 - 180;
  inspectorBody.append(rangeControl(el, angleSpec, Math.round(deg), (v) => {
    applyParam(el, 'angle', v);
    state.dirty = true;
  }));

  for (const spec of PARAMS[el.kind]) {
    const control = rangeControl(el, spec, el[spec.key], (v) => {
      applyParam(el, spec.key, v);
      state.dirty = true;
      if (spec.key === 'wavelength') updateSwatch(el);
    });
    if (spec.key === 'wavelength') {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.id = 'wavelength-swatch';
      control.querySelector('label').prepend(swatch);
    }
    inspectorBody.append(control);
  }
  if (el.wavelength) updateSwatch(el);

  if (hasMaterial(el)) {
    const wrap = document.createElement('div');
    wrap.className = 'param';
    const label = document.createElement('label');
    label.htmlFor = 'param-material';
    label.textContent = 'Glass';
    const select = document.createElement('select');
    select.id = 'param-material';
    for (const [key, m] of Object.entries(MATERIALS)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = `${m.name}, n = ${refractiveIndex(m, 589.3).toFixed(3)}`;
      select.append(option);
    }
    select.value = el.material;
    select.addEventListener('change', () => {
      applyParam(el, 'material', select.value);
      state.dirty = true;
    });
    wrap.append(label, select);
    inspectorBody.append(wrap);
  }

  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  const dup = document.createElement('button');
  dup.type = 'button';
  dup.textContent = 'Duplicate';
  dup.addEventListener('click', () => {
    const { id, kind, x, y, angle, ...params } = el;
    addElement(makeElement(kind, x + 30, y + 30, angle, params));
  });
  const del = document.createElement('button');
  del.type = 'button';
  del.textContent = 'Remove';
  del.addEventListener('click', () => removeSelected());
  buttons.append(dup, del);
  inspectorBody.append(buttons);
}

function updateSwatch(el) {
  const swatch = document.getElementById('wavelength-swatch');
  if (swatch) swatch.style.background = wavelengthToCss(el.wavelength);
}

// Editing ------------------------------------------------------------------

function select(id) {
  state.selected = id;
  buildInspector();
}

function addElement(el) {
  state.elements.push(el);
  state.dirty = true;
  select(el.id);
}

function removeSelected() {
  if (!state.selected) return;
  state.elements = state.elements.filter((el) => el.id !== state.selected);
  state.dirty = true;
  select(null);
}

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return vec(e.clientX - rect.left, e.clientY - rect.top);
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerPos(e);
  const sel = selectedElement();
  canvas.focus();
  if (sel && onHandle(sel, p)) {
    state.drag = { mode: 'rotate', el: sel };
  } else {
    const hit = elementAt(state.elements, p);
    if (hit !== sel) select(hit ? hit.id : null);
    if (hit) state.drag = { mode: 'move', el: hit, dx: hit.x - p.x, dy: hit.y - p.y };
  }
  if (state.drag) {
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointerPos(e);
  const { drag } = state;
  if (!drag) {
    const sel = selectedElement();
    const over = (sel && onHandle(sel, p)) || elementAt(state.elements, p);
    canvas.classList.toggle('over-element', Boolean(over));
    return;
  }
  if (drag.mode === 'move') {
    drag.el.x = p.x + drag.dx;
    drag.el.y = p.y + drag.dy;
  } else {
    let a = Math.atan2(p.y - drag.el.y, p.x - drag.el.x);
    if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
    drag.el.angle = a;
  }
  state.dirty = true;
});

function endDrag() {
  if (!state.drag) return;
  state.drag = null;
  canvas.classList.remove('dragging');
  buildInspector();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('keydown', (e) => {
  const el = selectedElement();
  if (e.key === '.') {
    if (!state.elements.length) return;
    const i = state.elements.findIndex((x) => x.id === state.selected);
    select(state.elements[(i + 1) % state.elements.length].id);
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    select(null);
    return;
  }
  if (!el) return;
  const step = e.shiftKey ? 10 : 1;
  const turn = ((e.shiftKey ? 15 : 1) * Math.PI) / 180;
  const moves = {
    ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
  };
  if (moves[e.key]) {
    el.x += moves[e.key][0];
    el.y += moves[e.key][1];
  } else if (e.key === '[') {
    el.angle -= turn;
  } else if (e.key === ']') {
    el.angle += turn;
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    removeSelected();
  } else {
    return;
  }
  e.preventDefault();
  state.dirty = true;
  if (e.key === '[' || e.key === ']') buildInspector();
});

for (const button of document.querySelectorAll('[data-add]')) {
  button.addEventListener('click', () => {
    const kind = button.dataset.add;
    const jitter = () => (Math.random() - 0.5) * 60;
    addElement(makeElement(kind, state.width / 2 + jitter(), state.height / 2 + jitter()));
  });
}

document.getElementById('clear').addEventListener('click', () => {
  state.elements = [];
  state.dirty = true;
  select(null);
});

gainInput.addEventListener('input', () => {
  gainValue.textContent = `${Number(gainInput.value).toFixed(2)}×`;
});
gainValue.textContent = `${Number(gainInput.value).toFixed(2)}×`;

window.addEventListener('resize', resize);
resize();
state.elements = defaultBench(state.width, state.height);
state.dirty = true;
buildInspector();
requestAnimationFrame(frame);
