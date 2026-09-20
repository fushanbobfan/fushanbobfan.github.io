import { Simulation } from './simulation.js';
import { drawFrame } from './render.js';
import { PRESETS, DEFAULT_PRESET, presetParams } from './presets.js';

const $ = (id) => document.getElementById(id);

const canvas = $('flock');
const ctx = canvas.getContext('2d');
const stage = canvas.parentElement;
const status = $('status');

const sliders = {
  separation: $('separation'),
  alignment: $('alignment'),
  cohesion: $('cohesion'),
  perception: $('perception'),
  maxSpeed: $('max-speed'),
};
const outputs = {
  separation: $('separation-value'),
  alignment: $('alignment-value'),
  cohesion: $('cohesion-value'),
  perception: $('perception-value'),
  maxSpeed: $('max-speed-value'),
};
const decimals = { separation: 1, alignment: 1, cohesion: 1, perception: 0, maxSpeed: 1 };

const countSlider = $('count');
const countOutput = $('count-value');
const presetSelect = $('preset');
const presetDescription = $('preset-description');
const edgeSelect = $('edge-mode');
const colourSelect = $('colour-mode');
const trailsBox = $('trails');
const pauseButton = $('pause');
const resetButton = $('reset');
const cursorSelect = $('cursor-mode');
const obstacleSizeSlider = $('obstacle-size');
const obstacleSizeOutput = $('obstacle-size-value');
const clearObstaclesButton = $('clear-obstacles');

const CURSOR_MODES = ['threat', 'place', 'remove'];

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let sim;
let paused = false;
let trails = false;
let colourMode = 'heading';
let cursorMode = 'threat';
let lastFrameTime = performance.now();
let fps = 0;

function stageSize() {
  const rect = stage.getBoundingClientRect();
  return { width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) };
}

function fitCanvas() {
  const { width, height } = stageSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (sim) sim.resize(width, height);
}

function syncSliders(params) {
  for (const key of Object.keys(sliders)) {
    sliders[key].value = params[key];
    outputs[key].value = Number(params[key]).toFixed(decimals[key]);
  }
}

function applyPreset(name) {
  const params = presetParams(name);
  sim.setParams(params);
  syncSliders(params);
  presetDescription.textContent = PRESETS[name].description;
}

function populatePresets() {
  for (const [name, preset] of Object.entries(PRESETS)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = preset.label;
    presetSelect.append(option);
  }
  presetSelect.value = DEFAULT_PRESET;
}

function setPaused(next) {
  paused = next;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(paused));
}

function setTrails(next) {
  trails = next;
  trailsBox.checked = next;
}

function setCursorMode(next) {
  cursorMode = next;
  cursorSelect.value = next;
  // The threat follows the pointer; the obstacle tools only act on clicks.
  if (next !== 'threat') sim.setThreat(null);
  canvas.style.cursor = next === 'threat' ? 'crosshair' : next === 'place' ? 'copy' : 'not-allowed';
}

function updateStatus() {
  const mode = paused ? 'paused' : `${fps.toFixed(0)} fps`;
  const obstacles = sim.obstacles.length ? ` · ${sim.obstacles.length} obstacle${sim.obstacles.length === 1 ? '' : 's'}` : '';
  status.textContent = `${sim.boids.length} boids${obstacles} · ${mode}`;
}

function frame(now) {
  const dt = now - lastFrameTime;
  lastFrameTime = now;
  if (dt > 0) fps = fps * 0.9 + (1000 / dt) * 0.1;
  if (!paused) sim.step();
  drawFrame(ctx, sim, { trails, colourMode });
  if (sim.tick % 15 === 0 || paused) updateStatus();
  requestAnimationFrame(frame);
}

function bindControls() {
  presetSelect.addEventListener('change', () => applyPreset(presetSelect.value));

  for (const key of Object.keys(sliders)) {
    sliders[key].addEventListener('input', () => {
      const value = Number(sliders[key].value);
      outputs[key].value = value.toFixed(decimals[key]);
      sim.setParams({ [key]: value });
    });
  }

  countSlider.addEventListener('input', () => {
    const n = Number(countSlider.value);
    countOutput.value = n;
    sim.setCount(n);
    updateStatus();
  });

  edgeSelect.addEventListener('change', () => sim.setEdgeMode(edgeSelect.value));
  colourSelect.addEventListener('change', () => { colourMode = colourSelect.value; });
  trailsBox.addEventListener('change', () => setTrails(trailsBox.checked));

  pauseButton.addEventListener('click', () => { setPaused(!paused); updateStatus(); });
  resetButton.addEventListener('click', () => { sim.reset(Date.now() >>> 0); updateStatus(); });

  const pointerPosition = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  canvas.addEventListener('pointermove', (event) => {
    if (cursorMode === 'threat') sim.setThreat(pointerPosition(event));
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = pointerPosition(event);
    if (cursorMode === 'threat') sim.setThreat(p);
    else if (cursorMode === 'place') sim.addObstacle(p.x, p.y, Number(obstacleSizeSlider.value));
    else sim.removeObstacleAt(p.x, p.y);
    updateStatus();
  });
  canvas.addEventListener('pointerleave', () => sim.setThreat(null));

  cursorSelect.addEventListener('change', () => setCursorMode(cursorSelect.value));
  obstacleSizeSlider.addEventListener('input', () => { obstacleSizeOutput.value = obstacleSizeSlider.value; });
  clearObstaclesButton.addEventListener('click', () => { sim.clearObstacles(); updateStatus(); });

  window.addEventListener('keydown', (event) => {
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (event.code === 'Space') { event.preventDefault(); setPaused(!paused); updateStatus(); }
    else if (event.key === 'r' || event.key === 'R') { sim.reset(Date.now() >>> 0); updateStatus(); }
    else if (event.key === 't' || event.key === 'T') setTrails(!trails);
    else if (event.key === 'o' || event.key === 'O') {
      setCursorMode(CURSOR_MODES[(CURSOR_MODES.indexOf(cursorMode) + 1) % CURSOR_MODES.length]);
    }
    else if (event.key === 'x' || event.key === 'X') { sim.clearObstacles(); updateStatus(); }
  });

  window.addEventListener('resize', fitCanvas);
}

function init() {
  populatePresets();
  const { width, height } = stageSize();
  sim = new Simulation({
    width,
    height,
    count: Number(countSlider.value),
    seed: Date.now() >>> 0,
    params: presetParams(DEFAULT_PRESET),
  });
  fitCanvas();
  applyPreset(DEFAULT_PRESET);
  bindControls();
  // Respect reduced-motion users: start paused so the page opens still.
  if (reducedMotion.matches) setPaused(true);
  updateStatus();
  requestAnimationFrame(frame);
}

init();
