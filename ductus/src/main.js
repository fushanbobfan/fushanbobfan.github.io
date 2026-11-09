import {
  deCasteljau, split, sample, derivative, curvature, normal, elevate, arcLength,
  isRational, conicKind, circleWeight, lengthTable, tAtFraction,
} from './bezier.js';
import {
  BOARD, MAX_POINTS, MIN_POINTS, SCENES, sceneById, scenePoints, withExtraPoint, withoutPoint, clampToBoard,
  weightFromSlider, sliderFromWeight, withWeight, asCircularArc,
} from './scenes.js';

const $ = (id) => document.getElementById(id);

const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const board = $('board');
const handles = $('handles');
const tInput = $('t');

const state = {
  points: scenePoints(SCENES[0]),
  t: Number(tInput.value),
  playing: false,
  selected: 1,
  fraction: 0,
};

const LEVEL_HUES = [205, 150, 40, 285, 15, 95, 330, 180];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const size = Math.round(board.clientWidth * dpr) || BOARD;
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  ctx.setTransform(size / BOARD, 0, 0, size / BOARD, 0, 0);
}

function polyline(pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
}

function dot(p, r, fill) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawComb(points) {
  const teeth = 120;
  let peak = 0;
  const ks = [];
  for (let i = 0; i <= teeth; i++) {
    const k = curvature(points, i / teeth);
    ks.push(k);
    if (Number.isFinite(k)) peak = Math.max(peak, Math.abs(k));
  }
  if (peak === 0) return;
  const scale = Math.min(90 / peak, 4000);
  const tips = [];
  ctx.strokeStyle = cssVar('--comb');
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.75;
  for (let i = 0; i <= teeth; i++) {
    const t = i / teeth;
    const base = deCasteljau(points, t).at(-1)[0];
    const n = normal(points, t);
    // The curvature vector points into the turn; the teeth stand outside it.
    const len = Math.max(-140, Math.min(140, ks[i] * scale));
    const tip = { x: base.x - n.x * len, y: base.y - n.y * len };
    tips.push(tip);
    polyline([base, tip]);
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  polyline(tips);
}

function drawTicks(points) {
  const table = lengthTable(points);
  const tick = cssVar('--ink');
  ctx.strokeStyle = tick;
  ctx.lineWidth = 2;
  for (let k = 0; k <= 10; k++) {
    const t = tAtFraction(points, k / 10, table);
    const p = deCasteljau(points, t).at(-1)[0];
    const n = normal(points, t);
    polyline([{ x: p.x - n.x * 11, y: p.y - n.y * 11 }, { x: p.x + n.x * 11, y: p.y + n.y * 11 }]);
  }
  for (let k = 0; k <= 10; k++) {
    const p = deCasteljau(points, k / 10).at(-1)[0];
    dot(p, 5, cssVar('--point'));
  }
}

function draw() {
  fitCanvas();
  const pts = state.points;
  ctx.clearRect(0, 0, BOARD, BOARD);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = cssVar('--polygon');
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  polyline(pts);
  ctx.setLineDash([]);

  if ($('show-comb').checked) drawComb(pts);

  if ($('show-split').checked) {
    const { left, right } = split(pts, state.t);
    ctx.lineWidth = 5;
    ctx.strokeStyle = cssVar('--left');
    polyline(sample(left, 160));
    ctx.strokeStyle = cssVar('--right');
    polyline(sample(right, 160));
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = cssVar('--left');
    polyline(left);
    ctx.strokeStyle = cssVar('--right');
    polyline(right);
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = cssVar('--curve');
    ctx.lineWidth = 4;
    polyline(sample(pts, 240));
  }

  if ($('show-ticks').checked) drawTicks(pts);

  const levels = deCasteljau(pts, state.t);
  if ($('show-construction').checked) {
    const dark = cssVar('--paper').toLowerCase() < '#808080';
    for (let L = 1; L < levels.length - 1; L++) {
      const hue = LEVEL_HUES[(L - 1) % LEVEL_HUES.length];
      const color = `hsl(${hue} 60% ${dark ? 65 : 40}%)`;
      ctx.strokeStyle = color;
      ctx.lineWidth = L === levels.length - 2 ? 2.5 : 1.75;
      polyline(levels[L]);
      for (const p of levels[L]) dot(p, 3.5, color);
    }
  }
  const onCurve = levels.at(-1)[0];
  dot(onCurve, 7, cssVar('--ink'));
  dot(onCurve, 4, cssVar('--panel'));

  placeHandles();
  readout(onCurve);
}

function fmt(v, digits = 1) {
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function readout(p) {
  const pts = state.points;
  const n = pts.length - 1;
  const names = ['', 'a straight line', 'quadratic', 'cubic', 'quartic', 'quintic'];
  $('r-degree').textContent = names[n] ? `${n} (${names[n]})` : String(n);
  $('r-kind').textContent = kindOf(pts);
  $('r-point').textContent = `(${fmt(p.x)}, ${fmt(p.y)})`;
  const d = derivative(pts, state.t);
  $('r-speed').textContent = `${fmt(Math.hypot(d.x, d.y))} per unit of t`;
  const k = Math.abs(curvature(pts, state.t));
  $('r-curvature').textContent = k < 1e-7 ? '0' : fmt(k, 4);
  $('r-radius').textContent = k < 1e-7 ? 'straight' : k > 10 ? 'under 0.1' : fmt(1 / k);
  const total = arcLength(pts, 0, 1, 48);
  $('r-length').textContent = fmt(total);
  $('r-share').textContent = total > 0 ? `${fmt((100 * arcLength(pts, 0, state.t, 48)) / total)}%` : '–';
  $('t-value').textContent = state.t.toFixed(2);
  $('add').disabled = pts.length >= MAX_POINTS;
  $('elevate').disabled = pts.length >= MAX_POINTS;
  $('circle').disabled = pts.length !== 3;
  $('reset-weights').disabled = !isRational(pts);
  syncWeight();
}

function kindOf(pts) {
  const conic = conicKind(pts);
  if (conic === 'ellipse') {
    const [a, b, c] = pts;
    const even = Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y)) < 0.5;
    if (even && Math.abs(pts[1].w - circleWeight(pts)) < 0.005) return 'circular arc';
  }
  if (conic) return `${conic} arc`;
  return isRational(pts) ? 'rational' : 'polynomial';
}

function syncWeight() {
  const i = Math.min(state.selected, state.points.length - 1);
  const w = state.points[i].w ?? 1;
  $('w-index').textContent = String(i);
  $('w-value').textContent = w.toFixed(2);
  if (document.activeElement !== $('weight')) $('weight').value = String(sliderFromWeight(w));
}

// Handles are buttons so the keyboard can reach and move them.
function buildHandles() {
  handles.replaceChildren();
  state.points.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'handle';
    b.textContent = String(i);
    b.dataset.index = String(i);
    handles.append(b);
  });
}

function placeHandles() {
  const els = handles.children;
  if (els.length !== state.points.length) buildHandles();
  state.points.forEach((p, i) => {
    const el = handles.children[i];
    el.style.left = `${(p.x / BOARD) * 100}%`;
    el.style.top = `${(p.y / BOARD) * 100}%`;
    const w = p.w ?? 1;
    el.style.setProperty('--size', `${Math.round(26 + 7 * Math.log2(w))}px`);
    el.setAttribute('aria-label', `Control point ${i} at ${Math.round(p.x)}, ${Math.round(p.y)}${w === 1 ? '' : `, weight ${w.toFixed(2)}`}`);
  });
}

function boardPoint(e) {
  const r = board.getBoundingClientRect();
  return clampToBoard({ x: ((e.clientX - r.left) / r.width) * BOARD, y: ((e.clientY - r.top) / r.height) * BOARD });
}

let drag = null;

handles.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.handle');
  if (!el) return;
  e.preventDefault();
  el.focus();
  el.setPointerCapture(e.pointerId);
  drag = { index: Number(el.dataset.index), id: e.pointerId };
  state.selected = drag.index;
});

handles.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  state.points[drag.index] = { ...state.points[drag.index], ...boardPoint(e) };
  draw();
});

const endDrag = (e) => {
  if (drag && e.pointerId === drag.id) drag = null;
};
handles.addEventListener('pointerup', endDrag);
handles.addEventListener('pointercancel', endDrag);

function removePoint(index) {
  if (state.points.length <= MIN_POINTS) return;
  state.points = withoutPoint(state.points, index);
  state.selected = Math.min(state.selected, state.points.length - 1);
  buildHandles();
  draw();
  handles.children[Math.min(index, state.points.length - 1)]?.focus();
}

handles.addEventListener('dblclick', (e) => {
  const el = e.target.closest('.handle');
  if (el) removePoint(Number(el.dataset.index));
});

handles.addEventListener('keydown', (e) => {
  const el = e.target.closest('.handle');
  if (!el) return;
  const i = Number(el.dataset.index);
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    removePoint(i);
    return;
  }
  const step = e.shiftKey ? 20 : 4;
  const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!move) return;
  e.preventDefault();
  const p = state.points[i];
  state.points[i] = clampToBoard({ ...p, x: p.x + move[0], y: p.y + move[1] });
  draw();
});

handles.addEventListener('focusin', (e) => {
  const el = e.target.closest('.handle');
  if (!el) return;
  state.selected = Number(el.dataset.index);
  syncWeight();
});

$('weight').addEventListener('input', () => {
  const i = Math.min(state.selected, state.points.length - 1);
  state.points = withWeight(state.points, i, weightFromSlider(Number($('weight').value)));
  draw();
});

$('reset-weights').addEventListener('click', () => {
  state.points = state.points.map(({ x, y }) => ({ x, y }));
  draw();
});

$('circle').addEventListener('click', () => {
  state.points = asCircularArc(state.points, circleWeight);
  state.selected = 1;
  draw();
});

function loadScene(id) {
  const scene = sceneById(id);
  state.points = scenePoints(scene);
  state.selected = 1;
  $('scene-note').textContent = scene.note;
  buildHandles();
  draw();
}

const sceneSelect = $('scene');
for (const s of SCENES) sceneSelect.add(new Option(s.name, s.id));
sceneSelect.addEventListener('change', () => loadScene(sceneSelect.value));

$('add').addEventListener('click', () => {
  state.points = withExtraPoint(state.points);
  buildHandles();
  draw();
});

$('elevate').addEventListener('click', () => {
  if (state.points.length >= MAX_POINTS) return;
  state.points = elevate(state.points);
  buildHandles();
  draw();
});

tInput.addEventListener('input', () => {
  state.t = Number(tInput.value);
  draw();
});

for (const id of ['show-construction', 'show-comb', 'show-split', 'show-ticks']) $(id).addEventListener('change', draw);

$('even-play').addEventListener('change', () => {
  state.fraction = arcLength(state.points, 0, state.t, 48) / (arcLength(state.points, 0, 1, 48) || 1);
});

let last = 0;
function tick(now) {
  if (!state.playing) return;
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  if ($('even-play').checked) {
    state.fraction = (state.fraction + dt / 5) % 1;
    state.t = tAtFraction(state.points, state.fraction);
  } else {
    state.t = (state.t + dt / 5) % 1;
  }
  tInput.value = String(state.t);
  draw();
  requestAnimationFrame(tick);
}

const play = $('play');
play.addEventListener('click', () => {
  state.playing = !state.playing;
  play.setAttribute('aria-pressed', String(state.playing));
  play.textContent = state.playing ? 'Pause' : 'Play';
  last = 0;
  if (state.playing) {
    state.fraction = arcLength(state.points, 0, state.t, 48) / (arcLength(state.points, 0, 1, 48) || 1);
    requestAnimationFrame(tick);
  }
});

new ResizeObserver(draw).observe(board);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);

loadScene(SCENES[0].id);
