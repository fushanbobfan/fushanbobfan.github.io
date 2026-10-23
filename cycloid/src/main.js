import { G, traverse, stateAt } from './motion.js';
import { CURVES, cycloidThrough, cycloidTime, cycloidDepth } from './curves.js';
import { WORLD, fit, clampB, sketchPath } from './scene.js';

const COLORS = {
  cycloid: '#ffbe3c',
  arc: '#5ec8ff',
  parabola: '#b28cff',
  line: '#ff6b6b',
  drawn: '#6be38a',
};

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const state = {
  bx: 2.6,
  by: 1.3,
  stroke: [],
  drawing: false,
  draggingB: false,
  enabled: { cycloid: true, arc: true, parabola: true, line: true, drawn: true },
  running: false,
  startedAt: 0,
  t: 0,
  tracks: [],
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

function activeTracks() {
  return state.tracks.filter((tr) => state.enabled[tr.id]);
}

function fmt(t) {
  return Number.isFinite(t) ? `${t.toFixed(3)} s` : 'never';
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

function renderResults() {
  const body = $('results');
  body.textContent = '';
  const cyc = state.tracks.find((tr) => tr.id === 'cycloid').path.total;
  const rows = activeTracks()
    .filter((tr) => state.shown.has(tr.id))
    .sort((a, b) => a.path.total - b.path.total);
  for (const tr of rows) {
    const row = document.createElement('tr');
    const gap = tr.path.total - cyc;
    const cells = [
      tr.name,
      fmt(tr.path.total),
      tr.id === 'cycloid' ? '' : Number.isFinite(gap) ? `+${(gap * 1000).toFixed(0)} ms` : 'turns back',
    ];
    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      row.append(td);
    }
    row.firstChild.style.color = COLORS[tr.id];
    body.append(row);
  }
  if (!rows.length) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Release the beads to race.';
    td.style.color = 'var(--muted)';
    row.append(td);
    body.append(row);
  }
}

function renderReadout() {
  const { bx, by } = state;
  const { r, theta } = cycloidThrough(bx, by);
  $('r-b').textContent = `${bx.toFixed(2)} m across, ${by.toFixed(2)} m down`;
  $('r-cycloid').textContent = `r = ${r.toFixed(3)} m, rolled through ${((theta * 180) / Math.PI).toFixed(1)}°`;
  $('r-exact').textContent = `θ√(r/g) = ${cycloidTime(bx, by).toFixed(4)} s`;
  const dip = cycloidDepth(bx, by) - by;
  $('note').textContent = dip > 1e-6
    ? `B is more than π/2 times as far across as it is down, so the fastest track dips ${(dip * 100).toFixed(0)} cm below B and climbs back up to it.`
    : 'The fastest track is steepest at the start: the bead gains speed early and spends it covering the distance.';
}

// ---- race ----

function reset() {
  state.running = false;
  state.t = 0;
  state.shown.clear();
  buildTracks();
  $('release').textContent = 'Release';
  $('release').append(kbd('Space'));
  renderTrackList();
  renderResults();
  renderReadout();
  updateStatus();
}

function kbd(text) {
  const k = document.createElement('kbd');
  k.textContent = text;
  return k;
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
  const finite = activeTracks().map((tr) => tr.path.total).filter(Number.isFinite);
  const turning = activeTracks().filter((tr) => tr.path.turn).map((tr) => 2 * tr.path.turn.time);
  return Math.max(0, ...finite, ...turning.map((t) => Math.min(t, 6)));
}

function tick(now) {
  if (state.running) {
    state.t = ((now - state.startedAt) / 1000) * Number($('speed').value);
    let changed = false;
    for (const tr of activeTracks()) {
      const done = Number.isFinite(tr.path.total) ? state.t >= tr.path.total : state.t >= tr.path.turn.time;
      if (done && !state.shown.has(tr.id)) {
        state.shown.add(tr.id);
        changed = true;
      }
    }
    if (changed) renderResults();
    if (state.t >= raceLength() + 0.3) {
      state.running = false;
      state.t = Math.max(state.t, raceLength());
    }
    $('clock').textContent = Math.min(state.t, raceLength()).toFixed(3);
  } else if (!state.shown.size) {
    $('clock').textContent = '0.000';
  }
  draw();
  requestAnimationFrame(tick);
}

function updateStatus() {
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

function draw() {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  for (const tr of activeTracks()) strokePath(tr.path.pts, COLORS[tr.id] + 'aa', 2.5 * dpr);
  if (state.drawing) {
    strokePath(Float64Array.of(0, 0, ...state.stroke), COLORS.drawn, 2 * dpr, [6 * dpr, 5 * dpr]);
  }
  drawMarker(0, 0, 'A', false);
  drawMarker(state.bx, state.by, 'B', true);
  for (const tr of activeTracks()) {
    const p = stateAt(tr.path, state.t);
    const [px, py] = view.toScreen(p.x, p.y);
    ctx.beginPath();
    ctx.arc(px, py, 7 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = COLORS[tr.id];
    ctx.fill();
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = '#0c0c12';
    ctx.stroke();
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

canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = pointerWorld(e);
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
  if (state.draggingB) {
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

$('release').addEventListener('click', release);
$('reset').addEventListener('click', reset);
$('clear-drawn').addEventListener('click', () => {
  state.stroke = [];
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
    state.stroke = [];
    reset();
  } else if (moves[e.key] && document.activeElement === canvas) {
    e.preventDefault();
    [state.bx, state.by] = clampB(state.bx + moves[e.key][0], state.by + moves[e.key][1]);
    reset();
  }
});

new ResizeObserver(resize).observe(canvas);
resize();
reset();
requestAnimationFrame(tick);
