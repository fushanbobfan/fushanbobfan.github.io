import { GROUPS, byId, cellOps, basis, toFrac, toCart } from './groups.js';
import { copies, reachOf, anchor } from './tiling.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const PENS = ['#ffbe3c', '#ff7a59', '#e0457b', '#c792ea', '#6bd3ff', '#7ee08a', '#e6e4ee', '#2a2a38'];
const LATTICES = { oblique: 'Oblique', rectangular: 'Rectangular', square: 'Square', hexagonal: 'Hexagonal' };

const NOTES = {
  p1: 'Translations only. The motif repeats along two directions and nothing else.',
  p2: 'Half-turns about four kinds of centre in each cell, and no mirrors.',
  pm: 'Parallel mirror lines, nothing else.',
  pg: 'Parallel glide reflections: mirror, then slide half a cell. No true mirrors.',
  cm: 'Mirrors, with glide lines halfway between them.',
  pmm: 'Mirrors in two perpendicular directions, with half-turns where they cross.',
  pmg: 'Mirrors in one direction, glides across them, and half-turns that sit off the mirrors.',
  pgg: 'Glides in two perpendicular directions and half-turns, but no mirrors.',
  cmm: 'Perpendicular mirrors with half-turns at their crossings, and more half-turns off the mirrors.',
  p4: 'Quarter-turns and half-turns, no mirrors.',
  p4m: 'Mirrors along the sides and the diagonals of the square; every rotation centre lies on a mirror.',
  p4g: 'Quarter-turn centres off the mirrors, with mirrors at 45 degrees and glides between them.',
  p3: 'Third-turns about three kinds of centre, no mirrors.',
  p3m1: 'Third-turns with mirrors through every centre.',
  p31m: 'Third-turns with mirrors, but one kind of centre sits off every mirror.',
  p6: 'Sixth-, third- and half-turns, no mirrors.',
  p6m: 'The full symmetry of the hexagonal lattice: mirrors in six directions.',
};

const state = {
  group: byId('p4m'),
  shape: { ratio: 0.7, angle: 74 },
  cell: 120,
  strokes: [], // { pts: [[u, v], ...] fractional, color, width }
  live: null,
  pen: PENS[0],
  width: 4,
  paper: '#101018',
  showCell: true,
  originalOnly: false,
};

const cache = document.createElement('canvas');
const cctx = cache.getContext('2d');
let dpr = 1;

function B() {
  return basis(state.group.lattice, state.shape);
}

// World coordinates: one unit is one cell side, the origin at the centre of
// the canvas, y pointing down as on screen.
function toWorld(px, py) {
  return [(px - canvas.width / dpr / 2) / state.cell, (py - canvas.height / dpr / 2) / state.cell];
}

function viewRect() {
  const w = canvas.width / dpr / state.cell / 2;
  const h = canvas.height / dpr / state.cell / 2;
  return { x0: -w, y0: -h, x1: w, y1: h };
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  cache.width = canvas.width;
  cache.height = canvas.height;
  renderCache();
  draw();
}

function pathOf(points) {
  const p = new Path2D();
  if (points.length === 1) {
    p.moveTo(points[0][0], points[0][1]);
    p.lineTo(points[0][0] + 1e-4, points[0][1]);
    return p;
  }
  p.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) p.lineTo(points[i][0], points[i][1]);
  return p;
}

// Paint one stroke and all its copies onto a context.
function paintStroke(c, stroke, basisNow, view) {
  const pts = anchor(stroke.pts.map((q) => toCart(q, basisNow)), basisNow);
  const path = pathOf(pts);
  const base = [state.cell * dpr, 0, 0, state.cell * dpr, (canvas.width) / 2, (canvas.height) / 2];
  c.strokeStyle = stroke.color;
  c.lineWidth = stroke.width / state.cell;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const list = state.originalOnly ? null : copies(state.group, basisNow, view, reachOf(pts, basisNow) + stroke.width / state.cell);
  if (!list) {
    const s = toCart(stroke.pts[0], basisNow);
    const a = pts[0];
    c.setTransform(base[0], 0, 0, base[3], base[4] + (s[0] - a[0]) * base[0], base[5] + (s[1] - a[1]) * base[3]);
    c.stroke(path);
    return;
  }
  for (const t of list) {
    c.setTransform(
      base[0] * t[0], base[3] * t[1], base[0] * t[2], base[3] * t[3],
      base[0] * t[4] + base[4], base[3] * t[5] + base[5],
    );
    c.stroke(path);
  }
}

function renderCache() {
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.fillStyle = state.paper;
  cctx.fillRect(0, 0, cache.width, cache.height);
  const b = B();
  const view = viewRect();
  for (const s of state.strokes) paintStroke(cctx, s, b, view);
  cctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawCell() {
  const b = B();
  const s = state.cell * dpr;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const light = state.paper === '#f4efe3';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = light ? 'rgba(40, 40, 60, 0.35)' : 'rgba(230, 228, 238, 0.35)';
  ctx.lineWidth = 1.5 * dpr;
  ctx.setLineDash([6 * dpr, 5 * dpr]);
  ctx.beginPath();
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map((q) => toCart(q, b));
  corners.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy + y * s) : ctx.moveTo(cx + x * s, cy + y * s)));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(cache, 0, 0);
  if (state.live) paintStroke(ctx, state.live, B(), viewRect());
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state.showCell) drawCell();
}

function rebuild() {
  renderCache();
  draw();
}

// --- input ---------------------------------------------------------------

function pointerFrac(e) {
  const r = canvas.getBoundingClientRect();
  return toFrac(toWorld(e.clientX - r.left, e.clientY - r.top), B());
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  state.live = { pts: [pointerFrac(e)], color: state.pen, width: state.width };
  draw();
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.live) return;
  const q = pointerFrac(e);
  const last = state.live.pts[state.live.pts.length - 1];
  const [a, b] = [toCart(q, B()), toCart(last, B())];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) * state.cell < 1.5) return;
  state.live.pts.push(q);
  draw();
});

function finish() {
  if (!state.live) return;
  state.strokes.push(state.live);
  state.live = null;
  rebuild();
  status();
}

canvas.addEventListener('pointerup', finish);
canvas.addEventListener('pointercancel', finish);

function undo() {
  if (!state.strokes.length) return;
  state.strokes.pop();
  rebuild();
  status();
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
    state.showCell = !state.showCell;
    $('show-cell').checked = state.showCell;
    draw();
  }
});

// --- panel ---------------------------------------------------------------

function status() {
  const n = state.strokes.length;
  const per = cellOps(state.group).length;
  $('status').textContent = n
    ? `${n} stroke${n === 1 ? '' : 's'}, each drawn ${per} time${per === 1 ? '' : 's'} in every cell`
    : 'Draw anywhere on the canvas.';
}

function setGroup(id) {
  state.group = byId(id);
  const g = state.group;
  $('group').value = g.id;
  $('caption').textContent = g.id;
  $('r-orbifold').textContent = g.orbifold.replace(/x/g, '×');
  $('r-lattice').textContent = LATTICES[g.lattice] + (g.centred ? ', centred' : '');
  $('r-order').textContent = cellOps(g).length;
  $('group-note').textContent = NOTES[g.id];
  $('ratio-label').hidden = !(g.lattice === 'rectangular' || g.lattice === 'oblique');
  $('angle-label').hidden = g.lattice !== 'oblique';
  status();
  rebuild();
}

function buildPanel() {
  const sel = $('group');
  for (const [lat, label] of Object.entries(LATTICES)) {
    const og = document.createElement('optgroup');
    og.label = label;
    for (const g of GROUPS.filter((x) => x.lattice === lat)) {
      const o = document.createElement('option');
      o.value = g.id;
      o.textContent = `${g.id}  (${g.orbifold.replace(/x/g, '×')})`;
      og.append(o);
    }
    sel.append(og);
  }
  sel.addEventListener('change', () => setGroup(sel.value));

  const sw = $('swatches');
  PENS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `Pen colour ${i + 1}`);
    b.setAttribute('aria-checked', String(c === state.pen));
    b.addEventListener('click', () => {
      state.pen = c;
      sw.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    sw.append(b);
  });

  $('width').addEventListener('input', (e) => (state.width = Number(e.target.value)));
  $('undo').addEventListener('click', undo);
  $('clear').addEventListener('click', () => {
    state.strokes = [];
    rebuild();
    status();
  });
  $('cell').addEventListener('input', (e) => {
    state.cell = Number(e.target.value);
    rebuild();
  });
  $('ratio').addEventListener('input', (e) => {
    state.shape.ratio = Number(e.target.value);
    rebuild();
  });
  $('angle').addEventListener('input', (e) => {
    state.shape.angle = Number(e.target.value);
    rebuild();
  });
  $('show-cell').addEventListener('change', (e) => {
    state.showCell = e.target.checked;
    draw();
  });
  $('show-only').addEventListener('change', (e) => {
    state.originalOnly = e.target.checked;
    rebuild();
  });
  $('paper').addEventListener('change', (e) => {
    state.paper = e.target.value;
    rebuild();
  });
  $('save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = `glide-${state.group.id}.png`;
    a.href = cache.toDataURL('image/png');
    a.click();
  });
}

buildPanel();
setGroup(state.group.id);
window.addEventListener('resize', resize);
resize();
