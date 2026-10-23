import { G, traverse, stateAt } from './motion.js';
import { CURVES, cycloidThrough, cycloidTime, cycloidDepth, cycloidWheel } from './curves.js';
import { WORLD, fit, clampB, sketchPath } from './scene.js';
import { BOWL_R, bowlPoint, bowlPoints, swingPoints, timeToBottom, nearestS } from './bowl.js';

const COLORS = {
  cycloid: '#ffbe3c',
  arc: '#5ec8ff',
  parabola: '#b28cff',
  line: '#ff6b6b',
  drawn: '#6be38a',
};
const BEAD_COLORS = ['#ffbe3c', '#5ec8ff', '#b28cff', '#ff6b6b', '#6be38a', '#ff8fd0'];
const DEFAULT_STARTS = [-0.95, -0.7, -0.45, -0.2];
const MAX_BEADS = 6;
const BOWL_RUN = 30; // seconds of simulated swinging before the clock stops

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const state = {
  mode: 'race',
  bx: 2.6,
  by: 1.3,
  stroke: [],
  drawing: false,
  draggingB: false,
  enabled: { cycloid: true, arc: true, parabola: true, line: true, drawn: true },
  bowlKind: 'cycloid',
  starts: [...DEFAULT_STARTS],
  running: false,
  startedAt: 0,
  t: 0,
  tracks: [],
  swings: [],
  shown: new Set(),
};

let view = fit(canvas.width, canvas.height);

function buildTracks() {
  const { bx, by } = state;
  state.tracks = CURVES.map((c) => ({ id: c.id, name: c.name, path: traverse(c.points(bx, by)) }));
  if (state.stroke.length) {
    state.tracks.push({ id: 'drawn', name: 'My track', path: traverse(sketchPath(state.stroke, bx, by)) });
  }
}

function buildSwings() {
  state.swings = state.starts.map((s0, i) => {
    const { pts, bottom } = swingPoints(state.bowlKind, s0);
    const path = traverse(pts);
    return {
      id: i,
      s0,
      color: BEAD_COLORS[i],
      path,
      bottom,
      drop: bowlPoint(state.bowlKind, 0)[1] - pts[1],
      exact: timeToBottom(state.bowlKind, s0),
    };
  });
}

function activeTracks() {
  return state.tracks.filter((tr) => state.enabled[tr.id]);
}

function fmt(t) {
  return Number.isFinite(t) ? `${t.toFixed(3)} s` : 'never';
}

// A swing runs from the release point to its mirror image and back.
function swingState(sw, t) {
  const half = sw.path.total;
  let u = t % (2 * half);
  if (u > half) u = 2 * half - u;
  return stateAt(sw.path, u);
}

// ---- panel ----

function renderTrackList() {
  const list = $('tracks');
  list.textContent = '';
  const entries = [...CURVES.map((c) => [c.id, c.name]), ['drawn', 'My track']];
  for (const [id, name] of entries) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.disabled = id === 'drawn' && !state.stroke.length;
    box.checked = state.enabled[id] && !box.disabled;
    box.addEventListener('change', () => {
      state.enabled[id] = box.checked;
      reset();
    });
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = COLORS[id];
    label.append(box, sw, id === 'drawn' && !state.stroke.length ? `${name} (draw one)` : name);
    li.append(label);
    list.append(li);
  }
  $('clear-drawn').disabled = !state.stroke.length;
}

function tableRow(cells, color) {
  const row = document.createElement('tr');
  for (const text of cells) {
    const td = document.createElement('td');
    td.textContent = text;
    row.append(td);
  }
  row.firstChild.style.color = color;
  return row;
}

function emptyRow(text) {
  const row = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 3;
  td.textContent = text;
  td.style.color = 'var(--muted)';
  row.append(td);
  return row;
}

function setHead(cells) {
  const head = $('results-head');
  head.textContent = '';
  const row = document.createElement('tr');
  for (const text of cells) {
    const th = document.createElement('th');
    th.textContent = text;
    row.append(th);
  }
  head.append(row);
}

function renderResults() {
  const body = $('results');
  body.textContent = '';
  if (state.mode === 'bowl') {
    setHead(['Bead dropped', 'To the bottom', 'Exact']);
    const rows = state.swings.filter((sw) => state.shown.has(sw.id));
    for (const sw of rows) {
      body.append(tableRow([`${(sw.drop * 100).toFixed(0)} cm`, fmt(sw.path.times[sw.bottom]), fmt(sw.exact)], sw.color));
    }
    if (!rows.length) body.append(emptyRow(state.swings.length ? 'Release the beads.' : 'Click the bowl to place beads.'));
    return;
  }
  setHead(['Track', 'Time', 'vs cycloid']);
  const cyc = state.tracks.find((tr) => tr.id === 'cycloid').path.total;
  const rows = activeTracks()
    .filter((tr) => state.shown.has(tr.id))
    .sort((a, b) => a.path.total - b.path.total);
  for (const tr of rows) {
    const gap = tr.path.total - cyc;
    body.append(tableRow([
      tr.name,
      fmt(tr.path.total),
      tr.id === 'cycloid' ? '' : Number.isFinite(gap) ? `+${(gap * 1000).toFixed(0)} ms` : 'turns back',
    ], COLORS[tr.id]));
  }
  if (!rows.length) body.append(emptyRow('Release the beads to race.'));
}

function renderReadout() {
  if (state.mode === 'bowl') {
    const tau = Math.PI * Math.sqrt(BOWL_R / G);
    $('note').textContent = state.bowlKind === 'cycloid'
      ? `On a cycloid every bead reaches the bottom after π√(r/g) = ${tau.toFixed(3)} s, wherever it starts: Huygens' tautochrone. The beads arrive together and keep swinging in step.`
      : `The circle matches the cycloid at the bottom, so small swings take ${tau.toFixed(3)} s there too, but a bead dropped from higher takes longer: a pendulum's period grows with its amplitude.`;
    return;
  }
  const { bx, by } = state;
  const { r, theta } = cycloidThrough(bx, by);
  $('r-b').textContent = `${bx.toFixed(2)} m across, ${by.toFixed(2)} m down`;
  $('r-cycloid').textContent = `r = ${r.toFixed(3)} m, rolled through ${((theta * 180) / Math.PI).toFixed(1)}°`;
  $('r-exact').textContent = `θ√(r/g) = ${cycloidTime(bx, by).toFixed(4)} s`;
  $('r-wheel').textContent = `rolls at a steady √(gr) = ${Math.sqrt(G * r).toFixed(2)} m/s`;
  const dip = cycloidDepth(bx, by) - by;
  $('note').textContent = dip > 1e-6
    ? `B is more than π/2 times as far across as it is down, so the fastest track dips ${(dip * 100).toFixed(0)} cm below B and climbs back up to it.`
    : 'The fastest track is steepest at the start: the bead gains speed early and spends it covering the distance.';
}

function renderMode() {
  for (const el of document.querySelectorAll('[data-mode]')) el.hidden = el.dataset.mode !== state.mode;
  $('mode-race').setAttribute('aria-pressed', String(state.mode === 'race'));
  $('mode-bowl').setAttribute('aria-pressed', String(state.mode === 'bowl'));
  const race = state.mode === 'race';
  $('caption').textContent = race ? 'Track' : 'Bowl';
  $('hint').textContent = race
    ? 'drag B to move it · draw anywhere else to lay your own track · arrow keys move B'
    : 'click the bowl to place a bead · each one starts from rest';
  canvas.setAttribute('aria-label', race
    ? 'Race track from A to B. Arrow keys move B, space releases the beads.'
    : 'Bowl with beads placed on it. Space releases the beads.');
}

// ---- release ----

function reset() {
  state.running = false;
  state.t = 0;
  state.shown.clear();
  buildTracks();
  buildSwings();
  renderMode();
  renderTrackList();
  renderResults();
  renderReadout();
  updateStatus();
  $('bowl-clear').disabled = !state.starts.length;
}

function release() {
  if (state.running) return;
  state.shown.clear();
  state.t = 0;
  state.running = true;
  state.startedAt = performance.now();
  renderResults();
}

function raceLength() {
  if (state.mode === 'bowl') return BOWL_RUN;
  const finite = activeTracks().map((tr) => tr.path.total).filter(Number.isFinite);
  const turning = activeTracks().filter((tr) => tr.path.turn).map((tr) => 2 * tr.path.turn.time);
  return Math.max(0, ...finite, ...turning.map((t) => Math.min(t, 6)));
}

function newlyArrived() {
  let changed = false;
  if (state.mode === 'bowl') {
    for (const sw of state.swings) {
      if (state.t >= sw.path.times[sw.bottom] && !state.shown.has(sw.id)) {
        state.shown.add(sw.id);
        changed = true;
      }
    }
    return changed;
  }
  for (const tr of activeTracks()) {
    const done = Number.isFinite(tr.path.total) ? state.t >= tr.path.total : state.t >= tr.path.turn.time;
    if (done && !state.shown.has(tr.id)) {
      state.shown.add(tr.id);
      changed = true;
    }
  }
  return changed;
}

function tick(now) {
  if (state.running) {
    state.t = ((now - state.startedAt) / 1000) * Number($('speed').value);
    if (newlyArrived()) renderResults();
    const end = raceLength();
    if (state.t >= end + (state.mode === 'race' ? 0.3 : 0)) {
      state.running = false;
      state.t = state.mode === 'race' ? Math.max(state.t, end) : end;
    }
    $('clock').textContent = Math.min(state.t, end).toFixed(3);
  } else if (!state.shown.size) {
    $('clock').textContent = '0.000';
  }
  draw();
  requestAnimationFrame(tick);
}

function updateStatus() {
  if (state.mode === 'bowl') {
    $('status').textContent = `Bowl depth 2r = ${(2 * BOWL_R).toFixed(2)} m, g = ${G} m/s². Beads slide without friction and pass through each other.`;
    return;
  }
  const drawn = state.tracks.find((tr) => tr.id === 'drawn');
  if (drawn && drawn.path.turn) {
    $('status').textContent = 'My track climbs above A somewhere, so its bead runs out of energy and slides back.';
  } else if (drawn) {
    const cyc = state.tracks.find((tr) => tr.id === 'cycloid').path.total;
    const gap = drawn.path.total - cyc;
    $('status').textContent = `My track: ${fmt(drawn.path.total)}, ${(gap * 1000).toFixed(0)} ms behind the cycloid.`;
  } else {
    $('status').textContent = `g = ${G} m/s². No friction, no rolling: each bead trades height for speed, v = √(2gh).`;
  }
}

// ---- drawing ----

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  view = fit(canvas.width, canvas.height);
}

function strokePath(pts, color, width, dash) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = view.toScreen(pts[i], pts[i + 1]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGrid() {
  const dpr = window.devicePixelRatio || 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#1b1b26';
  ctx.fillStyle = '#4a4860';
  ctx.font = `${11 * dpr}px system-ui, sans-serif`;
  for (let x = 0; x <= WORLD.x1; x += 0.5) {
    const [px, top] = view.toScreen(x, WORLD.y0);
    const [, bottom] = view.toScreen(x, WORLD.y1);
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, bottom);
    ctx.stroke();
    if (x % 1 === 0 && x > 0) ctx.fillText(`${x} m`, px + 3 * dpr, bottom - 4 * dpr);
  }
  for (let y = 0; y <= WORLD.y1; y += 0.5) {
    const [left, py] = view.toScreen(WORLD.x0, y);
    const [right] = view.toScreen(WORLD.x1, y);
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(right, py);
    ctx.stroke();
  }
}

function drawMarker(x, y, label, ring) {
  const dpr = window.devicePixelRatio || 1;
  const [px, py] = view.toScreen(x, y);
  ctx.beginPath();
  ctx.arc(px, py, 6 * dpr, 0, 2 * Math.PI);
  ctx.fillStyle = '#e6e4ee';
  ctx.fill();
  if (ring) {
    ctx.beginPath();
    ctx.arc(px, py, 11 * dpr, 0, 2 * Math.PI);
    ctx.strokeStyle = '#e6e4ee88';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
  }
  ctx.fillStyle = '#e6e4ee';
  ctx.font = `600 ${14 * dpr}px system-ui, sans-serif`;
  ctx.fillText(label, px + 12 * dpr, py - 10 * dpr);
}

function drawBead(x, y, color) {
  const dpr = window.devicePixelRatio || 1;
  const [px, py] = view.toScreen(x, y);
  ctx.beginPath();
  ctx.arc(px, py, 7 * dpr, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeStyle = '#0c0c12';
  ctx.stroke();
}

function drawBowl() {
  const dpr = window.devicePixelRatio || 1;
  const other = state.bowlKind === 'cycloid' ? 'circle' : 'cycloid';
  strokePath(bowlPoints(other), '#3a3850', 1.5 * dpr, [5 * dpr, 5 * dpr]);
  strokePath(bowlPoints(state.bowlKind), '#e6e4eecc', 3 * dpr);
  const [bx, by] = bowlPoint(state.bowlKind, 0);
  const [px, py] = view.toScreen(bx, by);
  ctx.strokeStyle = '#e6e4ee55';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(px, py + 6 * dpr);
  ctx.lineTo(px, py + 18 * dpr);
  ctx.stroke();
  for (const sw of state.swings) {
    const [sx, sy] = view.toScreen(sw.path.pts[0], sw.path.pts[1]);
    ctx.beginPath();
    ctx.arc(sx, sy, 3 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = sw.color + '88';
    ctx.fill();
    const p = swingState(sw, state.t);
    drawBead(p.x, p.y, sw.color);
  }
}

// The generating wheel rolls along the underside of the line through A;
// the bead on the cycloid track is the point on its rim.
function drawWheel() {
  const dpr = window.devicePixelRatio || 1;
  const w = cycloidWheel(state.bx, state.by, state.t);
  const { theta } = cycloidThrough(state.bx, state.by);
  strokePath(Float64Array.of(0, 0, w.r * theta + w.r, 0), '#ffbe3c55', 1.5 * dpr, [4 * dpr, 4 * dpr]);
  const [cx, cy] = view.toScreen(w.cx, w.cy);
  const [px, py] = view.toScreen(w.px, w.py);
  const [tx, ty] = view.toScreen(w.cx, 0);
  ctx.beginPath();
  ctx.arc(cx, cy, w.r * view.scale, 0, 2 * Math.PI);
  ctx.strokeStyle = '#ffbe3c66';
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(px, py);
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.strokeStyle = '#ffbe3c44';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5 * dpr, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffbe3c88';
  ctx.fill();
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  if (state.mode === 'bowl') {
    drawBowl();
    return;
  }
  if ($('wheel').checked && state.enabled.cycloid) drawWheel();
  for (const tr of activeTracks()) strokePath(tr.path.pts, COLORS[tr.id] + 'aa', 2.5 * dpr);
  if (state.drawing) {
    strokePath(Float64Array.of(0, 0, ...state.stroke), COLORS.drawn, 2 * dpr, [6 * dpr, 5 * dpr]);
  }
  drawMarker(0, 0, 'A', false);
  drawMarker(state.bx, state.by, 'B', true);
  for (const tr of activeTracks()) {
    const p = stateAt(tr.path, state.t);
    drawBead(p.x, p.y, COLORS[tr.id]);
  }
}

// ---- input ----

function pointerWorld(e) {
  const rect = canvas.getBoundingClientRect();
  const dpr = canvas.width / rect.width;
  return view.toWorld((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr);
}

function nearB(x, y) {
  return Math.hypot(x - state.bx, y - state.by) * view.scale < 18 * (window.devicePixelRatio || 1);
}

function placeBead(x, y) {
  const { s, distance } = nearestS(state.bowlKind, x, y);
  if (distance * view.scale > 40 * (window.devicePixelRatio || 1) || Math.abs(s) < 0.02) return;
  if (state.starts.length >= MAX_BEADS) state.starts.shift();
  state.starts.push(s);
  reset();
}

canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = pointerWorld(e);
  if (state.mode === 'bowl') {
    placeBead(x, y);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  if (nearB(x, y)) {
    state.draggingB = true;
  } else {
    state.drawing = true;
    state.stroke = [x, y];
  }
});

canvas.addEventListener('pointermove', (e) => {
  const [x, y] = pointerWorld(e);
  if (state.mode === 'bowl') {
    canvas.style.cursor = 'copy';
  } else if (state.draggingB) {
    [state.bx, state.by] = clampB(x, y);
    reset();
  } else if (state.drawing) {
    state.stroke.push(x, y);
  } else {
    canvas.style.cursor = nearB(x, y) ? 'grab' : 'crosshair';
  }
});

function endPointer() {
  if (state.drawing) {
    state.drawing = false;
    state.enabled.drawn = true;
    reset();
  }
  state.draggingB = false;
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

function setMode(mode) {
  state.mode = mode;
  reset();
}

function clearCurrent() {
  if (state.mode === 'bowl') state.starts = [];
  else state.stroke = [];
  reset();
}

$('mode-race').addEventListener('click', () => setMode('race'));
$('mode-bowl').addEventListener('click', () => setMode('bowl'));
$('release').addEventListener('click', release);
$('reset').addEventListener('click', reset);
$('clear-drawn').addEventListener('click', clearCurrent);
$('bowl-clear').addEventListener('click', clearCurrent);
$('bowl-default').addEventListener('click', () => {
  state.starts = [...DEFAULT_STARTS];
  reset();
});
$('bowl-kind').addEventListener('change', (e) => {
  state.bowlKind = e.target.value;
  reset();
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  const step = e.shiftKey ? 0.01 : 0.05;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    release();
  } else if (e.key === 'r' || e.key === 'R') {
    reset();
  } else if (e.key === 'c' || e.key === 'C') {
    clearCurrent();
  } else if (moves[e.key] && document.activeElement === canvas && state.mode === 'race') {
    e.preventDefault();
    [state.bx, state.by] = clampB(state.bx + moves[e.key][0], state.by + moves[e.key][1]);
    reset();
  }
});

new ResizeObserver(resize).observe(canvas);
resize();
reset();
requestAnimationFrame(tick);
