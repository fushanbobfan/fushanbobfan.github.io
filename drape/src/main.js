import { step, strain, maxStrain } from './cloth.js';
import { nearest, cut, togglePin, grab, drag, release, pinCount } from './tools.js';
import { PRESETS, WORLD, buildScene, newBall } from './presets.js';
import { fit, toWorld, toScreen, PALETTE, strainBucket } from './view.js';
import { catenary, rmsGap } from './catenary.js';

const DT = 1 / 120;
const MAX_STEPS = 4;
const REACH = 0.12;
const HAND = 0.08;
const NUDGE = 0.05;

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

const HINTS = {
  grab: 'drag the cloth &middot; flick to throw &middot; drag a pin or the ball to move it',
  cut: 'slash across the cloth to cut threads',
  pin: 'click a point to pin or unpin it',
};

const state = {
  scene: 'curtain',
  cloth: null,
  tool: 'grab',
  paused: false,
  held: null,
  ball: null,
  ballGrab: null,
  pointer: null,
  pointerVel: [0, 0],
  lastMove: 0,
  trail: [],
  cutting: false,
  view: null,
  dpr: 1,
  acc: 0,
  last: 0,
  frame: 0,
};

function settings() {
  return {
    wind: Number($('wind').value),
    gravity: Number($('gravity').value),
    tearAt: $('unbreakable').checked ? Infinity : Number($('tear').value),
    iterations: Number($('iterations').value),
    floor: WORLD.floor,
    balls: state.ball ? [state.ball] : [],
  };
}

function setScene(name) {
  state.scene = name;
  state.cloth = buildScene(name);
  state.held = null;
  state.ballGrab = null;
  if (state.ball) state.ball = newBall();
  state.trail = [];
  $('wind').value = PRESETS[name].wind;
  $('caption').textContent = PRESETS[name].label;
  $('chain-panel').hidden = PRESETS[name].rows !== 1;
  $('status').textContent = state.paused ? 'Paused.' : '';
  syncOutputs();
  readout();
}

function setTool(tool) {
  state.tool = tool;
  for (const t of ['grab', 'cut', 'pin']) $(`tool-${t}`).setAttribute('aria-pressed', String(t === tool));
  canvas.dataset.tool = tool;
  $('hint').innerHTML = HINTS[tool];
}

function setPaused(p) {
  state.paused = p;
  $('pause').firstChild.textContent = p ? 'Resume ' : 'Pause ';
  $('status').textContent = p ? 'Paused.' : '';
}

function syncOutputs() {
  const w = Number($('wind').value);
  $('wind-out').textContent = w === 0 ? 'calm' : `${Math.abs(w).toFixed(1)} m/s² ${w > 0 ? '→' : '←'}`;
  $('gravity-out').textContent = `${Number($('gravity').value).toFixed(2)} m/s²`;
  const unbreakable = $('unbreakable').checked;
  $('tear').disabled = unbreakable;
  const tear = Number($('tear').value);
  $('tear-out').textContent = unbreakable ? 'never' : `${Math.round((tear - 1) * 100)}% stretch`;
  $('scale-max').textContent = unbreakable ? '50% stretch' : 'tearing';
  $('iter-out').textContent = `${$('iterations').value} passes`;
}

function resize() {
  state.dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * state.dpr);
  canvas.height = Math.round(rect.height * state.dpr);
  state.view = fit(WORLD, canvas.width, canvas.height, 8 * state.dpr);
}

function eventWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return toWorld(state.view, (e.clientX - rect.left) * state.dpr, (e.clientY - rect.top) * state.dpr);
}

function setBall(on) {
  state.ball = on ? newBall() : null;
  state.ballGrab = null;
  $('ball').checked = on;
}

// Keep the ball inside the world and resting on the floor at the lowest.
function moveBall(x, y) {
  const b = state.ball;
  b.x = Math.min(Math.max(x, b.r), WORLD.width - b.r);
  b.y = Math.min(Math.max(y, b.r), WORLD.floor - b.r);
}

function slit() {
  const c = state.cloth;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let k = 0; k < c.n; k++) {
    minX = Math.min(minX, c.x[k]); maxX = Math.max(maxX, c.x[k]);
    minY = Math.min(minY, c.y[k]); maxY = Math.max(maxY, c.y[k]);
  }
  const mx = (minX + maxX) / 2 + c.spacing * 0.37;
  const n = cut(c, mx, minY + (maxY - minY) * 0.25, mx, maxY + 1);
  $('status').textContent = `Slit cut through ${n} threads.`;
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = eventWorld(e);
  state.pointer = [x, y];
  state.pointerVel = [0, 0];
  state.lastMove = performance.now();
  const c = state.cloth;
  const tool = e.button === 2 || e.shiftKey ? 'cut' : state.tool;
  if (tool === 'grab') {
    state.held = grab(c, x, y, HAND);
    const b = state.ball;
    if (!state.held && b && Math.hypot(x - b.x, y - b.y) < b.r) state.ballGrab = [b.x - x, b.y - y];
    if (state.held || state.ballGrab) canvas.classList.add('holding');
  } else if (tool === 'pin') {
    const k = nearest(c, x, y, REACH);
    if (k >= 0) togglePin(c, k);
  } else {
    state.trail = [[x, y, performance.now()]];
    state.cutting = true;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.pointer) return;
  const [x, wy] = eventWorld(e);
  const y = Math.min(wy, WORLD.floor);
  const now = performance.now();
  const dt = Math.max((now - state.lastMove) / 1000, 1e-3);
  state.pointerVel = [(x - state.pointer[0]) / dt, (y - state.pointer[1]) / dt];
  if (state.ballGrab) moveBall(x + state.ballGrab[0], y + state.ballGrab[1]);
  if (state.cutting) {
    cut(state.cloth, state.pointer[0], state.pointer[1], x, y);
    state.trail.push([x, y, now]);
  }
  state.pointer = [x, y];
  state.lastMove = now;
});

function endPointer() {
  if (state.held) {
    const stale = performance.now() - state.lastMove > 80;
    const [vx, vy] = stale ? [0, 0] : state.pointerVel;
    release(state.cloth, state.held, vx, vy, DT);
    state.held = null;
  }
  state.ballGrab = null;
  canvas.classList.remove('holding');
  state.cutting = false;
  state.pointer = null;
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === ' ') { e.preventDefault(); setPaused(!state.paused); }
  else if (key === 'r') setScene(state.scene);
  else if (key === 't') slit();
  else if (key === 'g') setTool('grab');
  else if (key === 'c') setTool('cut');
  else if (key === 'p') setTool('pin');
  else if (key === 'b') setBall(!state.ball);
  else if (state.ball && e.target === canvas && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const [dx, dy] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    moveBall(state.ball.x + dx * NUDGE, state.ball.y + dy * NUDGE);
  }
});

for (const t of ['grab', 'cut', 'pin']) $(`tool-${t}`).addEventListener('click', () => setTool(t));
$('reset').addEventListener('click', () => setScene(state.scene));
$('pause').addEventListener('click', () => setPaused(!state.paused));
$('slit').addEventListener('click', slit);
$('ball').addEventListener('change', (e) => setBall(e.target.checked));
$('scene').addEventListener('change', (e) => setScene(e.target.value));
for (const id of ['wind', 'gravity', 'tear', 'unbreakable', 'iterations']) $(id).addEventListener('input', syncOutputs);

// The catenary for the current chain, while it is a single intact row hanging
// from pins at both ends; its length is the chain's present, slightly
// stretched length so the comparison is of shape alone.
function chainCurve(c) {
  if (c.rows !== 1 || c.brokenCount > 0 || !c.pinned[0] || !c.pinned[c.n - 1]) return null;
  let length = 0;
  for (let k = 1; k < c.n; k++) length += Math.hypot(c.x[k] - c.x[k - 1], c.y[k] - c.y[k - 1]);
  const curve = catenary(c.x[0], c.y[0], c.x[c.n - 1], c.y[c.n - 1], length);
  return curve && { ...curve, length };
}

function drawCurve(curve, v) {
  ctx.save();
  ctx.strokeStyle = '#6fd3c1';
  ctx.lineWidth = 2 * state.dpr;
  ctx.setLineDash([6 * state.dpr, 5 * state.dpr]);
  ctx.beginPath();
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const x = curve.x1 + ((curve.x2 - curve.x1) * i) / steps;
    const [sx, sy] = toScreen(v, x, curve.yAt(x));
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.restore();
}

function draw() {
  const c = state.cloth;
  const v = state.view;
  const o = settings();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const [, fy] = toScreen(v, 0, WORLD.floor);
  ctx.fillStyle = '#16161f';
  ctx.fillRect(0, fy, canvas.width, canvas.height - fy);
  ctx.strokeStyle = '#2a2a38';
  ctx.lineWidth = state.dpr;
  ctx.beginPath();
  ctx.moveTo(0, fy);
  ctx.lineTo(canvas.width, fy);
  ctx.stroke();

  if (state.ball) {
    const [bx, by] = toScreen(v, state.ball.x, state.ball.y);
    ctx.fillStyle = '#1d1d29';
    ctx.strokeStyle = state.ballGrab ? '#f7a247' : '#3a3a4c';
    ctx.lineWidth = 2 * state.dpr;
    ctx.beginPath();
    ctx.arc(bx, by, state.ball.r * v.scale, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  const paths = PALETTE.map(() => new Path2D());
  const { a, b, broken, count } = c.links;
  for (let m = 0; m < count; m++) {
    if (broken[m]) continue;
    const p = paths[strainBucket(strain(c, m), o.tearAt)];
    p.moveTo(v.ox + c.x[a[m]] * v.scale, v.oy + c.y[a[m]] * v.scale);
    p.lineTo(v.ox + c.x[b[m]] * v.scale, v.oy + c.y[b[m]] * v.scale);
  }
  ctx.lineWidth = 1.2 * state.dpr;
  ctx.lineCap = 'round';
  for (let i = 0; i < PALETTE.length; i++) {
    ctx.strokeStyle = PALETTE[i];
    ctx.stroke(paths[i]);
  }

  const curve = $('show-catenary').checked ? chainCurve(c) : null;
  if (curve) drawCurve(curve, v);

  ctx.fillStyle = '#e6e4ee';
  const held = state.held ? state.held.k : -1;
  const inHand = new Set(state.held ? state.held.members.map((m) => m.k) : []);
  for (let k = 0; k < c.n; k++) {
    if (!c.pinned[k] || inHand.has(k)) continue;
    const [sx, sy] = toScreen(v, c.x[k], c.y[k]);
    ctx.beginPath();
    ctx.arc(sx, sy, 3.2 * state.dpr, 0, 2 * Math.PI);
    ctx.fill();
  }
  if (held >= 0) {
    const [sx, sy] = toScreen(v, c.x[held], c.y[held]);
    ctx.strokeStyle = '#f7a247';
    ctx.lineWidth = 2 * state.dpr;
    ctx.beginPath();
    ctx.arc(sx, sy, HAND * v.scale, 0, 2 * Math.PI);
    ctx.stroke();
  }

  const now = performance.now();
  state.trail = state.trail.filter((p) => now - p[2] < 300);
  if (state.trail.length > 1) {
    ctx.strokeStyle = 'rgba(255, 107, 107, 0.8)';
    ctx.lineWidth = 2 * state.dpr;
    ctx.beginPath();
    state.trail.forEach(([x, y], i) => {
      const [sx, sy] = toScreen(v, x, y);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
  }
}

function readout() {
  const c = state.cloth;
  const intact = c.links.count - c.brokenCount;
  $('r-particles').textContent = c.n.toLocaleString();
  $('r-threads').textContent = intact.toLocaleString();
  $('r-torn').textContent = c.brokenCount.toLocaleString();
  const inHand = state.held ? state.held.members.filter((m) => !m.wasPinned).length : 0;
  $('r-pins').textContent = (pinCount(c) - inHand).toLocaleString();
  $('r-strain').textContent = `${(maxStrain(c) * 100).toFixed(1)}%`;
  if (c.rows === 1) chainReadout(c);
}

const cm = (m) => `${(m * 100).toFixed(1)} cm`;

function chainReadout(c) {
  const curve = chainCurve(c);
  if (!curve) {
    for (const id of ['r-span', 'r-length', 'r-a', 'r-sag', 'r-gap']) $(id).textContent = '–';
    $('chain-note').textContent = c.brokenCount > 0
      ? 'The chain is broken, so it no longer hangs as one curve. Rehang it to compare again.'
      : 'Pin both ends of the chain, side by side and close enough for it to sag, to compare it with the catenary.';
    return;
  }
  const n = c.n;
  let lowest = 0;
  for (let k = 0; k < n; k++) if (c.y[k] > c.y[lowest]) lowest = k;
  const top = Math.min(c.y[0], c.y[n - 1]);
  $('r-span').textContent = cm(curve.x2 - curve.x1);
  $('r-length').textContent = cm(curve.length);
  $('r-a').textContent = cm(curve.a);
  $('r-sag').textContent = `${cm(c.y[lowest] - top)} / ${cm(curve.lowest.y - top)}`;
  $('r-gap').textContent = `${(rmsGap(curve, c.x, c.y) * 1000).toFixed(1)} mm rms`;
  $('chain-note').textContent = 'Drag either pin to change the span or the height of a support; the dashed curve follows.';
}

function frame(t) {
  const elapsed = state.last ? Math.min((t - state.last) / 1000, 0.1) : 0;
  state.last = t;
  if (!state.paused) {
    const o = settings();
    state.acc += elapsed;
    let steps = 0;
    while (state.acc >= DT && steps < MAX_STEPS) {
      if (state.held && state.pointer) drag(state.cloth, state.held, state.pointer[0], state.pointer[1]);
      step(state.cloth, DT, o);
      state.acc -= DT;
      steps++;
    }
    if (steps === MAX_STEPS) state.acc = 0;
  } else if (state.held && state.pointer) {
    drag(state.cloth, state.held, state.pointer[0], state.pointer[1]);
  }
  draw();
  if (++state.frame % 10 === 0) readout();
  requestAnimationFrame(frame);
}

for (const [name, p] of Object.entries(PRESETS)) {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = p.label;
  $('scene').append(opt);
}
$('scale').innerHTML = PALETTE.map((col) => `<span style="background:${col}"></span>`).join('');

window.addEventListener('resize', resize);
resize();
setTool('grab');
setScene(state.scene);
requestAnimationFrame(frame);
