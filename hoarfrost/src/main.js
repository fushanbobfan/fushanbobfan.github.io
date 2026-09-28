import { makeGrid } from './hexgrid.js';
import { createModel, step, EDGE_MARGIN } from './reiter.js';
import { buildPixelMap } from './layout.js';
import { cellColors, MODES } from './palette.js';
import {
  SPECS, DEFAULTS, normalize, encodeParams, decodeParams, sliderRange, toSlider, fromSlider,
} from './params.js';
import { PRESETS, findPreset } from './presets.js';

const MAX_RENDER = 900;

const canvas = document.getElementById('crystal');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const playBtn = document.getElementById('play');
const presetSelect = document.getElementById('preset');
const presetNote = document.getElementById('preset-note');
const slidersEl = document.getElementById('sliders');
const modeSelect = document.getElementById('mode');
const speedInput = document.getElementById('speed');
const speedValue = document.getElementById('speed-value');

const state = {
  params: { ...DEFAULTS },
  grid: null,
  model: null,
  colors: null,
  pixels: null,
  image: null,
  running: true,
  dirty: true,
  inputs: {},
};

// Set-up -------------------------------------------------------------------

function restart() {
  const { params } = state;
  if (!state.grid || state.grid.radius !== params.radius) {
    state.grid = makeGrid(params.radius);
    state.colors = new Uint32Array(state.grid.count);
    state.pixels = null;
  }
  state.model = createModel(state.grid, params);
  state.dirty = true;
  resize();
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const side = Math.max(1, Math.round(Math.min(rect.width, rect.height) * dpr));
  const scale = Math.min(1, MAX_RENDER / side);
  const w = Math.max(1, Math.round(rect.width * dpr * scale));
  const h = Math.max(1, Math.round(rect.height * dpr * scale));
  if (state.pixels && state.pixels.width === w && state.pixels.height === h
    && state.pixels.radius === state.grid.radius) return;
  canvas.width = w;
  canvas.height = h;
  state.pixels = { ...buildPixelMap(state.grid, w, h), radius: state.grid.radius };
  state.image = ctx.createImageData(w, h);
  state.dirty = true;
}

// Drawing ------------------------------------------------------------------

function draw() {
  const { model, pixels, image, colors } = state;
  cellColors(model, modeSelect.value, colors);
  const out = new Uint32Array(image.data.buffer);
  const { map } = pixels;
  const background = 0xff0c0604;
  for (let i = 0; i < map.length; i++) {
    const c = map[i];
    out[i] = c < 0 ? background : colors[c];
  }
  ctx.putImageData(image, 0, 0);
}

function updateStatus() {
  const { model } = state;
  const reach = Math.round((100 * model.extent) / (model.grid.radius - EDGE_MARGIN));
  const parts = [
    `step ${model.step.toLocaleString()}`,
    `${model.iceCount.toLocaleString()} ice cells`,
    `${reach}% of the way to the edge`,
  ];
  if (model.done) parts.push('finished');
  else if (!state.running) parts.push('paused');
  statusEl.textContent = parts.join(' · ');
}

function frame() {
  const { model } = state;
  if (state.running && !model.done) {
    step(model, Number(speedInput.value));
    state.dirty = true;
  }
  if (state.dirty) {
    draw();
    updateStatus();
    state.dirty = false;
  }
  requestAnimationFrame(frame);
}

// Controls -----------------------------------------------------------------

function setRunning(on) {
  state.running = on;
  playBtn.textContent = on ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-pressed', String(on));
  state.dirty = true;
}

function syncInputs() {
  for (const [name, { input, out }] of Object.entries(state.inputs)) {
    input.value = toSlider(name, state.params[name]);
    out.textContent = String(state.params[name]);
  }
}

function showPreset() {
  const preset = PRESETS.find((p) => Object.keys(p.params)
    .every((k) => p.params[k] === state.params[k]));
  presetSelect.value = preset ? preset.id : 'custom';
  presetNote.textContent = preset ? preset.note : 'Your own settings.';
}

function applyParams(params) {
  state.params = normalize(params);
  syncInputs();
  showPreset();
  restart();
  setRunning(true);
}

function buildSliders() {
  for (const [name, spec] of Object.entries(SPECS)) {
    const wrap = document.createElement('div');
    wrap.className = 'param';
    const head = document.createElement('div');
    head.className = 'param-head';
    const label = document.createElement('label');
    label.htmlFor = `param-${name}`;
    label.textContent = spec.label;
    const out = document.createElement('output');
    out.htmlFor = label.htmlFor;
    head.append(label, out);
    const input = document.createElement('input');
    input.type = 'range';
    input.id = label.htmlFor;
    Object.assign(input, sliderRange(name));
    input.addEventListener('input', () => {
      out.textContent = String(fromSlider(name, input.value));
    });
    input.addEventListener('change', () => {
      applyParams({ ...state.params, [name]: fromSlider(name, input.value) });
    });
    wrap.append(head, input);
    slidersEl.append(wrap);
    state.inputs[name] = { input, out };
  }
}

function buildSelects() {
  for (const preset of PRESETS) {
    presetSelect.append(new Option(preset.name, preset.id));
  }
  presetSelect.append(new Option('Custom', 'custom'));
  presetSelect.addEventListener('change', () => {
    const preset = findPreset(presetSelect.value);
    if (preset) applyParams({ ...state.params, ...preset.params });
  });
  for (const [id, name] of Object.entries(MODES)) modeSelect.append(new Option(name, id));
  modeSelect.addEventListener('change', () => {
    state.dirty = true;
  });
}

playBtn.addEventListener('click', () => setRunning(!state.running));
document.getElementById('step').addEventListener('click', () => {
  setRunning(false);
  step(state.model, 1);
  state.dirty = true;
});
document.getElementById('restart').addEventListener('click', () => {
  restart();
  setRunning(true);
});

speedInput.addEventListener('input', () => {
  speedValue.textContent = speedInput.value;
});
speedValue.textContent = speedInput.value;

document.getElementById('copy-link').addEventListener('click', async () => {
  const url = new URL(window.location.href);
  url.hash = encodeParams(state.params);
  window.history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url.href);
    statusEl.textContent = 'Link to these settings copied to the clipboard.';
  } catch {
    statusEl.textContent = 'The address bar now holds a link to these settings.';
  }
});

document.getElementById('save').addEventListener('click', () => {
  const link = document.createElement('a');
  const { alpha, beta, gamma } = state.params;
  link.download = `hoarfrost-a${alpha}-b${beta}-g${gamma}-step${state.model.step}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
    setRunning(!state.running);
  } else if (e.key === 'n' || e.key === 'N') {
    setRunning(false);
    step(state.model, 1);
    state.dirty = true;
  } else if (e.key === 'r' || e.key === 'R') {
    restart();
    setRunning(true);
  } else {
    return;
  }
  e.preventDefault();
});

window.addEventListener('resize', () => {
  resize();
});
window.addEventListener('hashchange', () => {
  const shared = decodeParams(window.location.hash);
  if (shared) applyParams(shared);
});

buildSliders();
buildSelects();
applyParams(decodeParams(window.location.hash) || { ...DEFAULTS, ...PRESETS[0].params });
requestAnimationFrame(frame);
