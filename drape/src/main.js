import { step, strain, maxStrain } from './cloth.js';
import { nearest, cut, togglePin, grab, drag, release, pinCount } from './tools.js';
import { PRESETS, WORLD, buildScene } from './presets.js';
import { fit, toWorld, toScreen, PALETTE, strainBucket } from './view.js';

const DT = 1 / 120;
const MAX_STEPS = 4;
const REACH = 0.12;
const HAND = 0.08;

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

const HINTS = {
  grab: 'drag the cloth &middot; flick to throw &middot; drag a pin to move it',
  cut: 'slash across the cloth to cut threads',
  pin: 'click a point to pin or unpin it',
};

const state = {
  scene: 'curtain',
  cloth: null,
  tool: 'grab',
  paused: false,
  held: null,
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
  };
}

function setScene(name) {
  state.scene = name;
  state.cloth = buildScene(name);
  state.held = null;
  state.trail = [];
  $('wind').value = PRESETS[name].wind;
  $('caption').textContent = PRESETS[name].label;
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
    if (state.held) canvas.classList.add('holding');
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
    canvas.classList.remove('holding');
  }
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
});

for (const t of ['grab', 'cut', 'pin']) $(`tool-${t}`).addEventListener('click', () => setTool(t));
$('reset').addEventListener('click', () => setScene(state.scene));
$('pause').addEventListener('click', () => setPaused(!state.paused));
$('slit').addEventListener('click', slit);
$('scene').addEventListener('change', (e) => setScene(e.target.value));
for (const id of ['wind', 'gravity', 'tear', 'unbreakable', 'iterations']) $(id).addEventListener('input', syncOutputs);

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
