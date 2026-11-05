import { CLASSICAL, angleGap, isValidMachine, pinPosition, wrapAngle } from './machine.js';
import { restPoints, settle } from './equilibria.js';
import { findCusps, traceFoldSet } from './foldset.js';
import { TOUR_NAMES, makeTour } from './tours.js';
import { driveWheel } from './wheel.js';
import { decodeState, encodeState } from './share.js';
import { foldsOnLine, offsetOfLine, positionOnLine, sliceCurve, sweepAlong } from './slice.js';
import { DEFAULT_TURN, buildRibs, clampPitch, surfaceBox } from './surface.js';
import { drawEnergy, drawMachine, drawSlice, drawSurface, fitCanvas, makeView, paintSurface, shadeWells } from './view.js';

const $ = (id) => document.getElementById(id);
const machineCanvas = $('machine');
const energyCanvas = $('energy');
const sliceCanvas = $('slice');
const surfaceCanvas = $('surface');
const machineCtx = machineCanvas.getContext('2d');
const energyCtx = energyCanvas.getContext('2d');
const sliceCtx = sliceCanvas.getContext('2d');
const surfaceCtx = surfaceCanvas.getContext('2d');

const HAND_SPEED = 1.6;
const TOUR_SPEED = 0.55;
const TRAIL_LIMIT = 4000;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TOUR_NOTES = {
  snap: 'Going down, the wheel keeps its well through the whole diamond and snaps at the far edge. Coming back it snaps at the other edge. The gap between the two is hysteresis.',
  round: 'The same start and the same end as a trip across the diamond, with a path round the tip. The wheel turns to the other side smoothly, and nothing snaps.',
  level: 'Through the middle of the diamond, side to side. A second well opens and closes beside the wheel, and the wheel never needs it.',
  fork: 'On the axis, one well splits into two at the tip. C runs a hair above the axis, and that hair decides the side. Copy the path a hair below and the wheel goes the other way.',
};

const state = {
  ...decodeState(window.location.hash),
  omega: 0,
  rest: 0,
  target: null,
  tour: null,
  trail: [],
  snaps: [],
  snapCount: 0,
  chains: [],
  cusps: [],
  wells: [],
  hills: [],
  shade: null,
  view: null,
  options: { set: true, shade: true, trail: true },
  lineAxis: 'y',
  slice: null,
  history: [],
  historyLine: '',
  surface: { box: null, ribs: [], chains: [], layer: null },
  turn: { ...DEFAULT_TURN },
  wheelPath: [],
  dirty: true,
};
state.rest = settle(state.machine, state.control.x, state.control.y, state.theta);
state.theta = state.rest;

let shadeTimer = 0;
let ribsTimer = 0;
let ratio = 1;

function refreshWells() {
  const { minima, maxima } = restPoints(state.machine, state.control.x, state.control.y);
  state.wells = minima;
  state.hills = maxima;
}

function queueShade() {
  window.clearTimeout(shadeTimer);
  state.shade = null;
  shadeTimer = window.setTimeout(() => {
    state.shade = shadeWells(state.machine, state.view, machineCanvas.width, machineCanvas.height);
    state.dirty = true;
  }, 90);
}

function repaintSurface() {
  state.surface.layer = paintSurface(surfaceCanvas.width, surfaceCanvas.height, ratio, state.surface, state.turn);
  state.dirty = true;
}

// The ribs take a moment, so slider drags wait until the hand pauses.
function queueRibs() {
  window.clearTimeout(ribsTimer);
  const chains = state.chains;
  ribsTimer = window.setTimeout(() => {
    const box = surfaceBox(chains);
    state.surface = { box, chains, ribs: buildRibs(state.machine, box), layer: null };
    repaintSurface();
  }, 120);
}

function rebuildSet() {
  state.chains = traceFoldSet(state.machine);
  state.cusps = findCusps(state.machine, state.chains);
  state.view = makeView(machineCanvas, state.machine, state.chains);
  queueShade();
  queueRibs();
}

function resize() {
  ratio = fitCanvas(machineCanvas);
  fitCanvas(energyCanvas);
  fitCanvas(sliceCanvas);
  fitCanvas(surfaceCanvas);
  state.view = makeView(machineCanvas, state.machine, state.chains);
  state.slice = null;
  queueShade();
  if (state.surface.box) repaintSurface();
  state.dirty = true;
}

function lineRange() {
  const { left, right, top } = state.view;
  return state.lineAxis === 'y' ? [-top, top] : [left, right];
}

// Rebuild the slice when C leaves the line it was computed for. The wheel's path
// only means something on one line, so it starts afresh with the new one.
function refreshSlice() {
  const at = offsetOfLine({ axis: state.lineAxis }, state.control);
  if (state.slice && Math.abs(state.slice.line.at - at) < 1e-6) return;
  const line = { axis: state.lineAxis, at };
  const range = lineRange();
  const folds = foldsOnLine(state.chains, line);
  state.slice = { line, range, folds, segments: sliceCurve(state.machine, line, range) };
  if (state.historyLine !== `${line.axis}:${at}`) {
    state.history = [];
    state.historyLine = `${line.axis}:${at}`;
  }
  writeSliceNote(line, folds);
}

function writeSliceNote(line, folds) {
  const name = line.axis;
  if (folds.length < 2) {
    $('slice-note').textContent = 'This line misses the curve, so there is one well all along it and nothing to snap.';
    return;
  }
  const low = folds[0];
  const high = folds[folds.length - 1];
  $('slice-note').textContent = `Two wells from ${name} = ${low.toFixed(2)} to ${high.toFixed(2)}, a span of ${(high - low).toFixed(2)}.`;
}

function recordHistory() {
  const s = positionOnLine(state.slice.line, state.control);
  const last = state.history[state.history.length - 1];
  if (last && Math.abs(last.s - s) < 1e-4 && Math.abs(last.theta - state.theta) < 0.002) return;
  state.history.push({ s, theta: state.theta });
  if (state.history.length > TRAIL_LIMIT) state.history.shift();
  state.wheelPath.push({ x: state.control.x, y: state.control.y, theta: state.theta });
  if (state.wheelPath.length > TRAIL_LIMIT) state.wheelPath.shift();
}

function say(text) {
  $('status').textContent = text;
}

function degrees(theta) {
  return `${Math.round((wrapAngle(theta) * 180) / Math.PI)}°`;
}

// Move C along a straight piece, with the wheel following, and leave a trail.
function moveControl(to, dt) {
  driveWheel(state, state.machine, to, dt).forEach((snap) => {
    state.snaps.push(snap);
    state.snapCount += 1;
    say(`Snap: the well at ${degrees(snap.from)} is gone, and the wheel falls to ${degrees(snap.to)}.`);
  });
  const last = state.trail[state.trail.length - 1];
  if (!last || Math.hypot(last.x - to.x, last.y - to.y) > 0.01) {
    state.trail.push(to);
    if (state.trail.length > TRAIL_LIMIT) state.trail.shift();
  }
  refreshWells();
  refreshSlice();
  recordHistory();
  state.dirty = true;
}

function clampToView(p) {
  const { left, right, top } = state.view;
  return {
    x: Math.min(right - 0.05, Math.max(left + 0.05, p.x)),
    y: Math.min(top - 0.05, Math.max(-top + 0.05, p.y)),
  };
}

function setTourButtons(active) {
  for (const button of $('tours').children) {
    button.setAttribute('aria-pressed', String(button.dataset.tour === active));
  }
  $('tour-note').textContent = active ? TOUR_NOTES[active] : '';
}

function startTour(name) {
  const { path, start } = makeTour(name, state.chains, state.cusps);
  clearTrail();
  say('');
  state.target = null;
  // Lift the wheel into the well the story starts in, at the first point of the path.
  state.control = path[0];
  state.rest = settle(state.machine, path[0].x, path[0].y, start);
  state.theta = state.rest;
  state.omega = 0;
  state.tour = { name, path, leg: 1 };
  state.trail.push(path[0]);
  refreshWells();
  // Each tour reads best on the line it travels along.
  setLineAxis(Math.abs(path[1].x - path[0].x) > Math.abs(path[1].y - path[0].y) ? 'x' : 'y');
  refreshSlice();
  setTourButtons(name);
  state.dirty = true;
}

// Sweep from where C is now, so the wheel's history carries through the whole loop.
function startSweep() {
  refreshSlice();
  const { line, folds, range } = state.slice;
  state.target = null;
  say('');
  state.tour = { name: null, path: sweepAlong(line, state.control, folds, range), leg: 1 };
  setTourButtons(null);
}

function setLineAxis(axis) {
  state.lineAxis = axis;
  state.slice = null;
  for (const radio of document.querySelectorAll('input[name="line"]')) radio.checked = radio.value === axis;
}

function stopTour() {
  if (state.tour) {
    state.tour = null;
    setTourButtons(null);
  }
}

function advanceTour(dt) {
  const tour = state.tour;
  let budget = TOUR_SPEED * dt;
  let at = state.control;
  while (budget > 0 && tour.leg < tour.path.length) {
    const goal = tour.path[tour.leg];
    const d = Math.hypot(goal.x - at.x, goal.y - at.y);
    if (d <= budget) {
      budget -= d;
      at = goal;
      tour.leg += 1;
    } else {
      at = { x: at.x + ((goal.x - at.x) * budget) / d, y: at.y + ((goal.y - at.y) * budget) / d };
      budget = 0;
    }
  }
  moveControl(at, dt);
  if (tour.leg >= tour.path.length) state.tour = null;
}

function chaseTarget(dt) {
  const { x, y } = state.control;
  const d = Math.hypot(state.target.x - x, state.target.y - y);
  if (d < 1e-4) {
    moveControl(state.control, dt);
    return;
  }
  const step = Math.min(1, (HAND_SPEED * dt) / d);
  moveControl({ x: x + (state.target.x - x) * step, y: y + (state.target.y - y) * step }, dt);
}

function stillMoving() {
  return Math.abs(state.omega) > 1e-3 || Math.abs(angleGap(state.theta, state.rest)) > 1e-3;
}

function updateReadout() {
  const { machine: m, control, theta } = state;
  const pin = pinPosition(m, theta);
  const length = Math.hypot(control.x - pin.x, control.y - pin.y);
  $('r-wells').textContent = String(state.wells.length);
  $('r-angle').textContent = degrees(theta);
  $('r-band').textContent = length <= m.l ? 'slack' : `stretched ${(length - m.l).toFixed(2)}`;
  $('r-snaps').textContent = String(state.snapCount);
}

function draw() {
  const scene = { ...state, theta: state.theta };
  drawMachine(machineCtx, machineCanvas, ratio, scene);
  drawEnergy(energyCtx, energyCanvas, ratio, scene);
  scene.slice = { ...state.slice, history: state.history, control: state.control, theta: state.theta };
  drawSlice(sliceCtx, sliceCanvas, ratio, scene);
  drawSurface(surfaceCtx, surfaceCanvas, ratio, scene);
  updateReadout();
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (state.tour) advanceTour(dt);
  else if (state.target) chaseTarget(dt);
  else if (stillMoving()) moveControl(state.control, dt);
  if (reducedMotion) {
    state.theta = state.rest;
    state.omega = 0;
  }
  refreshSlice();
  if (state.dirty) {
    state.dirty = false;
    draw();
  }
  window.requestAnimationFrame(frame);
}

function clearTrail() {
  state.trail = [];
  state.snaps = [];
  state.snapCount = 0;
  state.history = [];
  state.wheelPath = [];
  state.dirty = true;
}

function turnSurface(dYaw, dPitch) {
  state.turn = { yaw: state.turn.yaw + dYaw, pitch: clampPitch(state.turn.pitch + dPitch) };
  if (state.surface.box) repaintSurface();
}

let turning = null;
surfaceCanvas.addEventListener('pointerdown', (event) => {
  surfaceCanvas.setPointerCapture(event.pointerId);
  surfaceCanvas.classList.add('dragging');
  turning = { x: event.clientX, y: event.clientY };
});
surfaceCanvas.addEventListener('pointermove', (event) => {
  if (!turning) return;
  turnSurface((event.clientX - turning.x) * 0.008, (event.clientY - turning.y) * 0.008);
  turning = { x: event.clientX, y: event.clientY };
});
function endTurn() {
  surfaceCanvas.classList.remove('dragging');
  turning = null;
}
surfaceCanvas.addEventListener('pointerup', endTurn);
surfaceCanvas.addEventListener('pointercancel', endTurn);
surfaceCanvas.addEventListener('dblclick', () => {
  state.turn = { ...DEFAULT_TURN };
  if (state.surface.box) repaintSurface();
});
surfaceCanvas.addEventListener('keydown', (event) => {
  const moves = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] };
  const move = moves[event.key];
  if (!move) return;
  event.preventDefault();
  turnSurface(move[0], move[1]);
});

function pointerWorld(event) {
  const box = machineCanvas.getBoundingClientRect();
  return state.view.toWorld(
    ((event.clientX - box.left) / box.width) * machineCanvas.width,
    ((event.clientY - box.top) / box.height) * machineCanvas.height,
  );
}

machineCanvas.addEventListener('pointerdown', (event) => {
  stopTour();
  machineCanvas.setPointerCapture(event.pointerId);
  machineCanvas.classList.add('dragging');
  state.target = clampToView(pointerWorld(event));
});

machineCanvas.addEventListener('pointermove', (event) => {
  if (machineCanvas.classList.contains('dragging')) state.target = clampToView(pointerWorld(event));
});

function endDrag() {
  machineCanvas.classList.remove('dragging');
}
machineCanvas.addEventListener('pointerup', endDrag);
machineCanvas.addEventListener('pointercancel', endDrag);

machineCanvas.addEventListener('keydown', (event) => {
  const step = event.shiftKey ? 0.1 : 0.02;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  const move = moves[event.key];
  if (!move) return;
  event.preventDefault();
  stopTour();
  state.target = clampToView({ x: state.control.x + move[0], y: state.control.y + move[1] });
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.ctrlKey || event.metaKey) return;
  if (event.key === 'c') clearTrail();
  if (event.key === 's') startSweep();
});

for (const radio of document.querySelectorAll('input[name="line"]')) {
  radio.addEventListener('change', () => {
    setLineAxis(radio.value);
    state.dirty = true;
  });
}

$('sweep').addEventListener('click', startSweep);

for (const [name, text] of Object.entries(TOUR_NAMES)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.dataset.tour = name;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => startTour(name));
  $('tours').append(button);
}

$('clear').addEventListener('click', clearTrail);

function syncMachineControls() {
  const m = state.machine;
  for (const key of ['a', 'l', 's']) {
    $(key).value = String(m[key]);
    $(`${key}-out`).textContent = m[key].toFixed(2);
  }
}

function applyMachine(next, note) {
  stopTour();
  state.machine = next;
  state.slice = null;
  state.historyLine = '';
  rebuildSet();
  state.control = clampToView(state.control);
  state.target = null;
  state.rest = settle(next, state.control.x, state.control.y, state.rest);
  clearTrail();
  refreshWells();
  syncMachineControls();
  $('machine-note').textContent = note;
  say('');
}

function onMachineInput() {
  const next = {
    r: CLASSICAL.r,
    a: Number($('a').value),
    l: Number($('l').value),
    s: Number($('s').value),
  };
  if (isValidMachine(next)) {
    applyMachine(next, '');
    $('machine-note').textContent = state.cusps.length === 2
      ? '2 cusps on this machine. The side cusps have given way to corners, where the moving band goes slack along an arc of the curve.'
      : `${state.cusps.length} cusps on this machine.`;
  } else {
    syncMachineControls();
    $('machine-note').textContent = 'The bands must be shorter than the gap from the wheel to A, or the fixed band goes slack.';
  }
}

for (const key of ['a', 'l', 's']) $(key).addEventListener('input', onMachineInput);
$('classical').addEventListener('click', () => applyMachine({ ...CLASSICAL }, ''));

const toggles = { 'show-set': 'set', 'show-shade': 'shade', 'show-trail': 'trail' };
for (const [id, key] of Object.entries(toggles)) {
  $(id).addEventListener('change', (event) => {
    state.options[key] = event.target.checked;
    state.dirty = true;
  });
}

$('share').addEventListener('click', async () => {
  const hash = encodeState({ machine: state.machine, control: state.control, theta: state.rest });
  window.history.replaceState(null, '', `#${hash}`);
  try {
    await navigator.clipboard.writeText(window.location.href);
    say('Link copied.');
  } catch {
    say('The link is in the address bar.');
  }
});

$('png').addEventListener('click', () => {
  machineCanvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'cusp-machine.png';
    link.click();
    URL.revokeObjectURL(link.href);
  });
});

window.addEventListener('resize', resize);

ratio = fitCanvas(machineCanvas);
fitCanvas(energyCanvas);
fitCanvas(sliceCanvas);
fitCanvas(surfaceCanvas);
rebuildSet();
state.control = clampToView(state.control);
state.trail.push(state.control);
refreshWells();
syncMachineControls();
window.requestAnimationFrame(frame);
