import { createRng } from './rng.js';
import { createRoad, step, setDensity, stopCarNear, occupancy, density as roadDensity } from './traffic.js';
import { PRESETS, DEFAULT_PRESET_ID, getPreset } from './presets.js';
import { RollingMean, FundamentalDiagram, createSweep, sweepDensity, sweepTick, sweepProgress } from './measure.js';
import { ringGeometry, cellAtPoint, drawRing, SpaceTime, drawDiagram } from './render.js';

const $ = (id) => document.getElementById(id);
const ring = $('ring');
const spacetime = $('spacetime');
const diagram = $('diagram');
const ringCtx = ring.getContext('2d');
const spaceCtx = spacetime.getContext('2d');
const diagramCtx = diagram.getContext('2d');

const HISTORY_ROWS = 400; // steps kept on the space–time diagram
const SETTLE_STEPS = 150; // steps after a change before flow samples count
const WINDOW = 120; // steps averaged for the status line and live reading

const controls = {
  preset: $('preset'),
  presetDescription: $('preset-description'),
  density: $('density'),
  vmax: $('vmax'),
  slow: $('slow'),
  cells: $('cells'),
  speed: $('speed'),
  pause: $('pause'),
  step: $('step'),
  reset: $('reset'),
  brake: $('brake'),
  sweep: $('sweep'),
  clearDiagram: $('clear-diagram'),
  status: $('status'),
};

const num = (el) => Number(el.value);

let pixelRatio = 1;

/** Size a canvas's backing store to its CSS box times the device pixel ratio. */
function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  pixelRatio = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.round(rect.width * pixelRatio);
  const h = Math.round(rect.height * pixelRatio);
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

function logicalSize(canvas) {
  return { width: canvas.width / pixelRatio, height: canvas.height / pixelRatio };
}

const sim = {
  road: null,
  row: null,
  history: new SpaceTime(makeCanvas, 200, HISTORY_ROWS),
  fd: new FundamentalDiagram(100),
  flow: new RollingMean(WINDOW),
  speed: new RollingMean(WINDOW),
  sinceChange: 0,
  paused: false,
  sweep: null,
  sweepReturnDensity: null,
  flash: null, // { pos, at } for the ring highlight after a brake
};

function makeCanvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function seed() {
  return Math.floor(Math.random() * 0xffffffff);
}

/** Rebuild the road from the sliders; the flow–density record survives. */
function buildRoad() {
  const cells = num(controls.cells);
  sim.road = createRoad({
    cells,
    density: num(controls.density),
    vmax: num(controls.vmax),
    slow: num(controls.slow),
    rng: createRng(seed()),
  });
  sim.row = new Int8Array(cells);
  sim.history.reset(cells, HISTORY_ROWS);
  sim.flow.reset();
  sim.speed.reset();
  sim.sinceChange = 0;
  sim.flash = null;
}

/** Something about the road changed: restart the settling clock. */
function markChange() {
  sim.sinceChange = 0;
  sim.flow.reset();
  sim.speed.reset();
}

function applyDensity(value) {
  setDensity(sim.road, value);
  controls.density.value = String(value);
  markChange();
}

function stepOnce() {
  const { road } = sim;
  let recording = sim.sinceChange >= SETTLE_STEPS;

  if (sim.sweep) {
    const tick = sweepTick(sim.sweep);
    recording = tick.recording;
    if (tick.changed) applyDensity(sweepDensity(sim.sweep));
    if (tick.done) finishSweep();
  }

  const stats = step(road);
  sim.sinceChange += 1;
  sim.flow.push(stats.flow);
  sim.speed.push(stats.meanSpeed);
  if (recording && road.cars.length > 0) sim.fd.add(roadDensity(road), stats.flow);
  sim.history.push(occupancy(road, sim.row), road.vmax);
}

function draw(now) {
  const { road } = sim;
  fitCanvas(ring);
  fitCanvas(spacetime);
  fitCanvas(diagram);

  const ringSize = logicalSize(ring);
  ringCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ringCtx.clearRect(0, 0, ringSize.width, ringSize.height);
  const geom = ringGeometry(ringSize.width, ringSize.height, road.cells);
  const flashAge = sim.flash ? (now - sim.flash.at) / 600 : 1;
  drawRing(ringCtx, road, geom, { flash: sim.flash, flashAge });
  if (flashAge >= 1) sim.flash = null;

  spaceCtx.setTransform(1, 0, 0, 1, 0, 0);
  sim.history.draw(spaceCtx, spacetime.width, spacetime.height);

  const chartSize = logicalSize(diagram);
  diagramCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const live = road.cars.length > 0 && sim.flow.count > 0 ? { density: roadDensity(road), flow: sim.flow.mean } : null;
  drawDiagram(diagramCtx, chartSize.width, chartSize.height, {
    points: sim.fd.points(),
    vmax: road.vmax,
    slow: road.slow,
    live,
    sweepFraction: sim.sweep ? sweepProgress(sim.sweep) : null,
  });
}

function updateStatus() {
  const { road } = sim;
  const parts = [
    `t = ${road.time}`,
    `${road.cars.length} car${road.cars.length === 1 ? '' : 's'}`,
    `density ${roadDensity(road).toFixed(2)}`,
    `flow ${sim.flow.mean.toFixed(3)} cars/step`,
    `mean speed ${sim.speed.mean.toFixed(2)}`,
    `${road.stats.stopped} stopped`,
  ];
  if (sim.sweep) parts.push(`sweep ${Math.round(sweepProgress(sim.sweep) * 100)}%`);
  else if (sim.sinceChange < SETTLE_STEPS) parts.push('settling');
  controls.status.textContent = parts.join(' · ');
}

let lastStatus = 0;
function frame(now) {
  if (!sim.paused) {
    const steps = num(controls.speed);
    for (let i = 0; i < steps; i++) stepOnce();
  }
  draw(now);
  if (now - lastStatus > 100) {
    updateStatus();
    lastStatus = now;
  }
  requestAnimationFrame(frame);
}

function setPaused(value) {
  sim.paused = value;
  controls.pause.textContent = value ? 'Resume' : 'Pause';
  controls.pause.setAttribute('aria-pressed', String(value));
}

function brakeAt(cell) {
  const car = stopCarNear(sim.road, cell);
  if (car) sim.flash = { pos: car.pos, at: performance.now() };
}

function brakeSomeone() {
  const { road } = sim;
  const moving = road.cars.filter((c) => c.vel > 0);
  const pool = moving.length > 0 ? moving : road.cars;
  if (pool.length === 0) return;
  const car = pool[Math.floor(Math.random() * pool.length)];
  brakeAt(car.pos);
}

function startSweep() {
  sim.sweepReturnDensity = num(controls.density);
  sim.sweep = createSweep({ from: 0.02, to: 0.98, stops: 49, settle: SETTLE_STEPS, sample: 300 });
  applyDensity(sweepDensity(sim.sweep));
  controls.density.disabled = true;
  controls.sweep.textContent = 'Stop sweep';
  controls.sweep.setAttribute('aria-pressed', 'true');
  setPaused(false);
}

function finishSweep() {
  sim.sweep = null;
  controls.density.disabled = false;
  controls.sweep.textContent = 'Sweep density';
  controls.sweep.setAttribute('aria-pressed', 'false');
  if (sim.sweepReturnDensity !== null) applyDensity(sim.sweepReturnDensity);
  sim.sweepReturnDensity = null;
}

function toggleSweep() {
  if (sim.sweep) finishSweep();
  else startSweep();
}

// --- Controls -------------------------------------------------------------

function refreshOutputs() {
  $('density-value').textContent = num(controls.density).toFixed(2);
  $('vmax-value').textContent = String(num(controls.vmax));
  $('slow-value').textContent = num(controls.slow).toFixed(2);
  $('cells-value').textContent = String(num(controls.cells));
  const s = num(controls.speed);
  $('speed-value').textContent = `${s} step${s === 1 ? '' : 's'}/frame`;
}

function applyPreset(id) {
  const preset = getPreset(id);
  controls.preset.value = preset.id;
  controls.presetDescription.textContent = preset.description;
  controls.density.value = String(preset.density);
  controls.vmax.value = String(preset.vmax);
  controls.slow.value = String(preset.slow);
  if (sim.sweep) finishSweep();
  sim.fd.clear();
  buildRoad();
  refreshOutputs();
}

function stepPreset(delta) {
  const index = PRESETS.findIndex((p) => p.id === controls.preset.value);
  const next = (index + delta + PRESETS.length) % PRESETS.length;
  applyPreset(PRESETS[next].id);
}

for (const preset of PRESETS) {
  const option = document.createElement('option');
  option.value = preset.id;
  option.textContent = preset.name;
  controls.preset.append(option);
}

controls.preset.addEventListener('change', () => applyPreset(controls.preset.value));

controls.density.addEventListener('input', () => {
  applyDensity(num(controls.density));
  refreshOutputs();
});

controls.vmax.addEventListener('input', () => {
  const vmax = num(controls.vmax);
  sim.road.vmax = vmax;
  for (const car of sim.road.cars) car.vel = Math.min(car.vel, vmax);
  sim.fd.clear();
  markChange();
  refreshOutputs();
});

controls.slow.addEventListener('input', () => {
  sim.road.slow = num(controls.slow);
  sim.fd.clear();
  markChange();
  refreshOutputs();
});

controls.cells.addEventListener('input', () => {
  if (sim.sweep) finishSweep();
  buildRoad();
  refreshOutputs();
});

controls.speed.addEventListener('input', refreshOutputs);

controls.pause.addEventListener('click', () => setPaused(!sim.paused));

controls.step.addEventListener('click', () => {
  setPaused(true);
  stepOnce();
  updateStatus();
});

controls.reset.addEventListener('click', () => {
  if (sim.sweep) finishSweep();
  buildRoad();
});

controls.brake.addEventListener('click', brakeSomeone);
controls.sweep.addEventListener('click', toggleSweep);
controls.clearDiagram.addEventListener('click', () => sim.fd.clear());

ring.addEventListener('pointerdown', (event) => {
  const rect = ring.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * logicalSize(ring).width;
  const y = ((event.clientY - rect.top) / rect.height) * logicalSize(ring).height;
  const geom = ringGeometry(logicalSize(ring).width, logicalSize(ring).height, sim.road.cells);
  const cell = cellAtPoint(geom, sim.road.cells, x, y);
  if (cell >= 0) brakeAt(cell);
});

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  switch (event.key) {
    case ' ':
      event.preventDefault();
      setPaused(!sim.paused);
      break;
    case '.':
      setPaused(true);
      stepOnce();
      updateStatus();
      break;
    case 'b':
    case 'B':
      brakeSomeone();
      break;
    case 'r':
    case 'R':
      if (sim.sweep) finishSweep();
      buildRoad();
      break;
    case 'd':
    case 'D':
      toggleSweep();
      break;
    case '[':
      stepPreset(-1);
      break;
    case ']':
      stepPreset(1);
      break;
    default:
      return;
  }
});

// --- Boot -----------------------------------------------------------------

applyPreset(DEFAULT_PRESET_ID);
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
requestAnimationFrame(frame);
