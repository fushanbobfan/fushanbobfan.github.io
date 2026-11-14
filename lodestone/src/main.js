import { makeSystem, step, trappedBy } from './model.js';
import { BasinMap, paint, hexToRgb } from './basins.js';
import { PRESETS, presetById } from './presets.js';

const $ = (id) => document.getElementById(id);

const MAGNET_COLORS = [
  { name: 'orange', hex: '#d0692c' },
  { name: 'blue', hex: '#2f78b0' },
  { name: 'green', hex: '#4f9a45' },
  { name: 'purple', hex: '#8e5aa8' },
];
const RGB = MAGNET_COLORS.map((c) => hexToRgb(c.hex));
const WHOLE_VIEW = { cx: 0, cy: 0, half: 2.5 };
const TWIN_OFFSET = 0.01;
const STEPS_PER_FRAME = 2;
const AFTER_CATCH = 4; // time units a caught bob keeps swinging on screen
const MAX_TRAIL = 8000;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const canvas = $('map');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const offscreen = document.createElement('canvas');
const off = offscreen.getContext('2d');

const state = {
  preset: PRESETS[0],
  magnets: [],
  params: { pull: 0.5, friction: 0.2, height: 0.25 },
  view: { ...WHOLE_VIEW },
  detail: 200,
  shadeTime: true,
  sys: null,
  map: null,
  image: null,
  paintedRows: -1,
  bobs: [],
  speed: 1,
  drag: null,
};

function fmt(v, digits = 2) {
  return Number(v).toFixed(digits);
}

// --- coordinates -----------------------------------------------------------

function worldToCanvas(x, y) {
  const { cx, cy, half } = state.view;
  return [((x - cx + half) / (2 * half)) * W, ((cy + half - y) / (2 * half)) * W];
}

function canvasToWorld(px, py) {
  const { cx, cy, half } = state.view;
  return [cx - half + (px / W) * 2 * half, cy + half - (py / W) * 2 * half];
}

function eventToCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * W];
}

// --- building the system and the map --------------------------------------

function rebuild() {
  state.sys = makeSystem(state.magnets, state.params);
  state.map = new BasinMap(state.sys, state.detail, state.view);
  offscreen.width = offscreen.height = state.detail;
  state.image = off.createImageData(state.detail, state.detail);
  state.paintedRows = -1;
  updateView();
}

let rebuildTimer = 0;
function rebuildSoon(delay = 180) {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuild, delay);
}

function loadPreset(p) {
  state.preset = p;
  state.magnets = p.magnets.map((m) => ({ ...m }));
  state.params = { pull: p.pull, friction: p.friction, height: p.height };
  state.view = { ...WHOLE_VIEW };
  for (const key of ['pull', 'friction', 'height']) $(key).value = state.params[key];
  showParams();
  $('preset-note').textContent = p.note;
  clearBobs();
  rebuild();
}

function showParams() {
  $('friction-out').textContent = fmt(state.params.friction);
  $('pull-out').textContent = fmt(state.params.pull);
  $('height-out').textContent = fmt(state.params.height);
}

// --- bobs --------------------------------------------------------------------

function newBob(x, y, twin) {
  return { s: { x, y, vx: 0, vy: 0 }, x0: x, y0: y, trail: [[x, y]], t: 0, caught: -1, caughtAt: 0, done: false, twin };
}

function release(x, y) {
  $('start-x').value = fmt(x, 3);
  $('start-y').value = fmt(y, 3);
  state.bobs = [newBob(x, y, false)];
  if ($('twin').checked) state.bobs.push(newBob(x + TWIN_OFFSET, y, true));
  if (reduceMotion.matches) {
    for (const b of state.bobs) while (!b.done) advance(b, 1);
  }
  describeFate();
}

function clearBobs() {
  state.bobs = [];
  describeFate();
}

function advance(bob, steps) {
  const sys = state.sys;
  for (let n = 0; n < steps && !bob.done; n++) {
    step(sys, bob.s);
    bob.t += sys.dt;
    if (bob.trail.length < MAX_TRAIL) bob.trail.push([bob.s.x, bob.s.y]);
    if (bob.caught < 0) {
      const i = trappedBy(sys, bob.s);
      if (i >= 0) {
        bob.caught = i;
        bob.caughtAt = bob.t;
      } else if (bob.t >= sys.maxTime) {
        bob.done = true;
      }
    } else if (bob.t - bob.caughtAt >= AFTER_CATCH) {
      bob.done = true;
    }
  }
}

function fateText(bob, label) {
  if (bob.caught >= 0) {
    return `${label} caught by the ${MAGNET_COLORS[bob.caught].name} magnet after ${fmt(bob.caughtAt, 1)} time units.`;
  }
  if (bob.done) return `${label} not caught within ${state.sys.maxTime} time units.`;
  return `${label} still swinging, ${fmt(bob.t, 1)} time units so far.`;
}

let lastFate = '';
function describeFate() {
  let text = 'No bob released yet.';
  if (state.bobs.length) {
    const [a, b] = state.bobs;
    text = fateText(a, `Released at (${fmt(a.x0)}, ${fmt(a.y0)}):`);
    if (b) {
      text += ' ' + fateText(b, `Its twin, ${TWIN_OFFSET} to the right:`);
      if (a.caught >= 0 && b.caught >= 0) {
        text += a.caught === b.caught ? ' Same magnet.' : ' Different magnets.';
      }
    }
  }
  // Rewrite the live region only when the words change, not on every frame.
  if (text !== lastFate) {
    lastFate = text;
    $('fate').textContent = text;
  }
}

// --- drawing -----------------------------------------------------------------

function paintMap() {
  const map = state.map;
  if (map.next === state.paintedRows) return;
  state.paintedRows = map.next;
  paint(map, state.image.data, RGB, [70, 70, 70], state.shadeTime);
  off.putImageData(state.image, 0, 0);
  $('progress-bar').style.width = `${Math.round(map.progress * 100)}%`;
  if (map.complete) showShares();
}

function showShares() {
  const { fractions } = state.map.shares();
  const list = $('shares');
  list.textContent = '';
  state.magnets.forEach((m, i) => {
    const li = document.createElement('li');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = MAGNET_COLORS[i].hex;
    const name = document.createElement('span');
    name.append(sw, `${MAGNET_COLORS[i].name} magnet`);
    const pct = document.createElement('span');
    pct.textContent = `${fmt(100 * fractions[i], 1)}% of the view`;
    li.append(name, pct);
    list.append(li);
  });
  const lost = fractions[state.magnets.length];
  if (lost > 0) {
    const li = document.createElement('li');
    li.append('not caught', ` ${fmt(100 * lost, 1)}%`);
    list.append(li);
  }
}

function updateView() {
  const { cx, cy, half } = state.view;
  $('view').textContent = `View: x from ${fmt(cx - half)} to ${fmt(cx + half)}, y from ${fmt(cy - half)} to ${fmt(cy + half)}.`;
  $('shares').textContent = '';
}

function strokeTrail(trail, under, over, dash) {
  if (trail.length < 2) return;
  ctx.beginPath();
  for (let i = 0; i < trail.length; i++) {
    const [px, py] = worldToCanvas(trail[i][0], trail[i][1]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = under;
  ctx.stroke();
  ctx.setLineDash(dash);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = over;
  ctx.stroke();
  ctx.setLineDash([]);
}

function draw() {
  ctx.clearRect(0, 0, W, W);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, 0, 0, W, W);

  for (const bob of state.bobs) {
    const twin = bob.twin;
    strokeTrail(bob.trail, twin ? '#fbf9f3' : '#1d1b17', twin ? '#1d1b17' : '#fbf9f3', twin ? [5, 4] : []);
    const [sx, sy] = worldToCanvas(bob.x0, bob.y0);
    ctx.fillStyle = twin ? '#1d1b17' : '#fbf9f3';
    ctx.strokeStyle = twin ? '#fbf9f3' : '#1d1b17';
    ctx.lineWidth = 1.5;
    ctx.fillRect(sx - 3, sy - 3, 6, 6);
    ctx.strokeRect(sx - 3, sy - 3, 6, 6);
    const [bx, by] = worldToCanvas(bob.s.x, bob.s.y);
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  state.magnets.forEach((m, i) => {
    const [px, py] = worldToCanvas(m.x, m.y);
    const r = 6 + 2 * Math.sqrt(m.strength);
    ctx.beginPath();
    ctx.arc(px, py, r + 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#fbf9f3';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 2 * Math.PI);
    ctx.fillStyle = MAGNET_COLORS[i].hex;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1d1b17';
    ctx.stroke();
  });
}

function frame() {
  if (state.map && !state.map.complete) state.map.work(10);
  if (state.map) paintMap();
  const steps = Math.max(1, Math.round(STEPS_PER_FRAME * state.speed));
  for (const bob of state.bobs) advance(bob, steps);
  if (state.bobs.length) describeFate();
  draw();
  requestAnimationFrame(frame);
}

// --- input -----------------------------------------------------------------

function magnetAt(px, py) {
  const r = canvas.getBoundingClientRect();
  const reach = 14 * (W / r.width);
  for (let i = state.magnets.length - 1; i >= 0; i--) {
    const [mx, my] = worldToCanvas(state.magnets[i].x, state.magnets[i].y);
    if (Math.hypot(px - mx, py - my) <= reach) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const [px, py] = eventToCanvas(e);
  const i = magnetAt(px, py);
  if (i >= 0) {
    state.drag = i;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
    clearBobs();
    return;
  }
  const [x, y] = canvasToWorld(px, py);
  release(x, y);
});

canvas.addEventListener('pointermove', (e) => {
  const [px, py] = eventToCanvas(e);
  if (state.drag === null) {
    canvas.classList.toggle('over-magnet', magnetAt(px, py) >= 0);
    return;
  }
  const [x, y] = canvasToWorld(px, py);
  state.magnets[state.drag].x = x;
  state.magnets[state.drag].y = y;
});

function endDrag() {
  if (state.drag === null) return;
  state.drag = null;
  canvas.classList.remove('dragging');
  rebuild();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function zoom(factor, px = W / 2, py = W / 2) {
  const [x, y] = canvasToWorld(px, py);
  const half = Math.min(8, Math.max(1e-4, state.view.half * factor));
  // Keep the point under the pointer fixed while the scale changes.
  state.view = { cx: x - (px / W - 0.5) * 2 * half, cy: y + (py / W - 0.5) * 2 * half, half };
  updateView();
  rebuildSoon();
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [px, py] = eventToCanvas(e);
  zoom(e.deltaY > 0 ? 1.25 : 0.8, px, py);
}, { passive: false });

$('zoom-in').addEventListener('click', () => zoom(0.5));
$('zoom-out').addEventListener('click', () => zoom(2));
$('zoom-reset').addEventListener('click', () => {
  state.view = { ...WHOLE_VIEW };
  rebuild();
});

for (const key of ['pull', 'friction', 'height']) {
  $(key).addEventListener('input', () => {
    state.params[key] = Number($(key).value);
    showParams();
    clearBobs();
    rebuildSoon();
  });
}

const select = $('preset');
for (const p of PRESETS) select.add(new Option(p.name, p.id));
select.addEventListener('change', () => loadPreset(presetById(select.value)));

$('detail').addEventListener('change', () => {
  state.detail = Number($('detail').value);
  rebuild();
});

$('shade').addEventListener('change', () => {
  state.shadeTime = $('shade').checked;
  state.paintedRows = -1;
});

$('speed').addEventListener('change', () => {
  state.speed = Number($('speed').value);
});

$('release').addEventListener('click', () => {
  const x = Number($('start-x').value);
  const y = Number($('start-y').value);
  if (Number.isFinite(x) && Number.isFinite(y)) release(x, y);
});

$('clear').addEventListener('click', clearBobs);

loadPreset(PRESETS[0]);
requestAnimationFrame(frame);
