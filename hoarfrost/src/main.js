import { makeGrid } from './hexgrid.js';
import { createModel, EDGE_MARGIN } from './reiter.js';
import { createSchedule, advance } from './schedule.js';
import { buildPixelMap } from './layout.js';
import { cellColors, MODES } from './palette.js';
import {
  SPECS, DEFAULTS, AT_SPEC, STAGE_DEFAULTS, normalize, normalizeStage, encodeParams, decodeParams,
  decodeStage, sliderRange, toSlider, fromSlider,
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
const stageOn = document.getElementById('stage-on');
const stageSlidersEl = document.getElementById('stage-sliders');
const modeSelect = document.getElementById('mode');
const speedInput = document.getElementById('speed');
const speedValue = document.getElementById('speed-value');

const state = {
  params: { ...DEFAULTS },
  stage: null,
  stageDraft: { ...STAGE_DEFAULTS },
  schedule: null,
  grid: null,
  model: null,
  colors: null,
  pixels: null,
  image: null,
  running: true,
  dirty: true,
  inputs: {},
  stageInputs: {},
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
  state.schedule = createSchedule(state.stage, state.stage?.at);
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
  const { model, schedule } = state;
  const reach = Math.round((100 * model.extent) / (model.grid.radius - EDGE_MARGIN));
  const parts = [
    `step ${model.step.toLocaleString()}`,
    `${model.iceCount.toLocaleString()} ice cells`,
    `${reach}% of the way to the edge`,
  ];
  if (schedule.switchedAt >= 0) parts.push(`second stage since step ${schedule.switchedAt.toLocaleString()}`);
  else if (schedule.second) parts.push(`second stage at ${Math.round(schedule.at * 100)}%`);
  if (model.done) parts.push('finished');
  else if (!state.running) parts.push('paused');
  statusEl.textContent = parts.join(' · ');
}

function frame() {
  const { model } = state;
  if (state.running && !model.done) {
    advance(model, state.schedule, Number(speedInput.value));
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

function stepOnce() {
  setRunning(false);
  advance(state.model, state.schedule, 1);
  state.dirty = true;
}

const percent = (v) => `${Math.round(v * 100)}%`;
const atValue = (v) => normalizeStage({ at: v }).at;
const sameStage = (a, b) => JSON.stringify(normalizeStage(a)) === JSON.stringify(normalizeStage(b));

function syncInputs() {
  for (const [name, { input, out }] of Object.entries(state.inputs)) {
    input.value = toSlider(name, state.params[name]);
    out.textContent = String(state.params[name]);
  }
  const stage = state.stage || state.stageDraft;
  stageOn.checked = Boolean(state.stage);
  for (const [name, { input, out }] of Object.entries(state.stageInputs)) {
    input.value = name === 'at' ? stage.at : toSlider(name, stage[name]);
    out.textContent = name === 'at' ? percent(stage.at) : String(stage[name]);
    input.disabled = !state.stage;
  }
}

function showPreset() {
  const preset = PRESETS.find((p) => Object.keys(p.params)
    .every((k) => p.params[k] === state.params[k]) && sameStage(p.stage, state.stage));
  presetSelect.value = preset ? preset.id : 'custom';
  presetNote.textContent = preset ? preset.note : 'Your own settings.';
}

function applyParams(params, stage = state.stage) {
  state.params = normalize(params);
  state.stage = normalizeStage(stage);
  if (state.stage) state.stageDraft = state.stage;
  syncInputs();
  showPreset();
  restart();
  setRunning(true);
}

function makeSlider(container, id, text, range, onInput, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'param';
  const head = document.createElement('div');
  head.className = 'param-head';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = text;
  const out = document.createElement('output');
  out.htmlFor = id;
  head.append(label, out);
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  Object.assign(input, range);
  input.addEventListener('input', () => {
    out.textContent = onInput(input.value);
  });
  input.addEventListener('change', () => onChange(input.value));
  wrap.append(head, input);
  container.append(wrap);
  return { input, out };
}

function buildSliders() {
  for (const [name, spec] of Object.entries(SPECS)) {
    state.inputs[name] = makeSlider(
      slidersEl,
      `param-${name}`,
      spec.label,
      sliderRange(name),
      (v) => String(fromSlider(name, v)),
      (v) => applyParams({ ...state.params, [name]: fromSlider(name, v) }),
    );
  }
  for (const name of ['beta', 'gamma']) {
    state.stageInputs[name] = makeSlider(
      stageSlidersEl,
      `stage-${name}`,
      `Then ${SPECS[name].label.charAt(0).toLowerCase()}${SPECS[name].label.slice(1)}`,
      sliderRange(name),
      (v) => String(fromSlider(name, v)),
      (v) => applyParams(state.params, { ...state.stage, [name]: fromSlider(name, v) }),
    );
  }
  state.stageInputs.at = makeSlider(
    stageSlidersEl,
    'stage-at',
    AT_SPEC.label,
    { min: AT_SPEC.min, max: AT_SPEC.max, step: AT_SPEC.step },
    (v) => percent(atValue(v)),
    (v) => applyParams(state.params, { ...state.stage, at: atValue(v) }),
  );
  stageOn.addEventListener('change', () => {
    applyParams(state.params, stageOn.checked ? state.stageDraft : null);
  });
}

function buildSelects() {
  for (const preset of PRESETS) {
    presetSelect.append(new Option(preset.name, preset.id));
  }
  presetSelect.append(new Option('Custom', 'custom'));
  presetSelect.addEventListener('change', () => {
    const preset = findPreset(presetSelect.value);
    if (preset) applyParams({ ...state.params, ...preset.params }, preset.stage || null);
  });
  for (const [id, name] of Object.entries(MODES)) modeSelect.append(new Option(name, id));
  modeSelect.addEventListener('change', () => {
    state.dirty = true;
  });
}

playBtn.addEventListener('click', () => setRunning(!state.running));
document.getElementById('step').addEventListener('click', stepOnce);
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
  url.hash = encodeParams(state.params, state.stage);
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
  const second = state.stage ? `-then-b${state.stage.beta}-g${state.stage.gamma}` : '';
  link.download = `hoarfrost-a${alpha}-b${beta}-g${gamma}${second}-step${state.model.step}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
    setRunning(!state.running);
  } else if (e.key === 'n' || e.key === 'N') {
    stepOnce();
  } else if (e.key === 'r' || e.key === 'R') {
    restart();
    setRunning(true);
  } else {
    return;
  }
  e.preventDefault();
});

function loadFromHash() {
  const shared = decodeParams(window.location.hash);
  if (shared) applyParams(shared, decodeStage(window.location.hash));
  return Boolean(shared);
}

window.addEventListener('resize', resize);
window.addEventListener('hashchange', loadFromHash);

buildSliders();
buildSelects();
if (!loadFromHash()) applyParams({ ...DEFAULTS, ...PRESETS[0].params }, null);
requestAnimationFrame(frame);
