import {
  GOLDEN_DEG, LUCAS_DEG, PHI, florets, continuedFraction, convergents,
  describeSpirals, neighbourSteps, packing,
} from './phyllo.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

const state = {
  deg: GOLDEN_DEG,
  count: 1200,
  shown: 1200,
  colour: 'spirals',
  lines: false,
  numbers: false,
  selected: -1,
  growing: 0,
};

let points = [];
let scale = 1; // pixels per unit of Vogel's spacing c
let rim = null;

const PRESETS = {
  golden: GOLDEN_DEG,
  lucas: LUCAS_DEG,
};

function turns() {
  return state.deg / 360;
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function size() {
  const rect = canvas.getBoundingClientRect();
  return { w: rect.width, h: rect.height };
}

function recompute() {
  points = florets(state.count, turns());
  rim = describeSpirals(Math.max(1, state.count - 1), turns(), Math.max(400, Math.ceil(5 * Math.sqrt(state.count))));
  if (state.selected >= state.count) state.selected = -1;
  updateReadout();
  draw();
}

function modInverse(a, m) {
  let [r0, r1, s0, s1] = [m, a, 0, 1];
  while (r1) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return r0 === 1 ? ((s0 % m) + m) % m : 0;
}

function floretColour(n, r, rMax) {
  if (state.colour === 'order') {
    const t = n / Math.max(1, state.count - 1);
    return `hsl(${(40 + 280 * t).toFixed(1)} 75% ${(62 - 18 * t).toFixed(1)}%)`;
  }
  if (state.colour === 'flower') {
    const t = r / rMax;
    if (t < 0.82) return `hsl(${(28 - 10 * t).toFixed(1)} ${(55 + 20 * t).toFixed(1)}% ${(20 + 22 * t).toFixed(1)}%)`;
    return `hsl(45 92% ${(52 + 10 * (t - 0.82) / 0.18).toFixed(1)}%)`;
  }
  // Stripes along the sparser family at the rim. Floret n lies on spiral
  // n mod k, and a step of pair[1] moves to the next spiral over, so the
  // spiral's place around the head is (n mod k) / pair[1], modulo k.
  const k = rim.spokes || rim.pair[0];
  const j = n % k;
  const inv = rim.spokes ? 0 : modInverse(rim.pair[1] % k, k);
  const band = inv ? (j * inv) % k : j;
  const t = band / k;
  return band % 2
    ? `hsl(${(38 + 14 * t).toFixed(1)} 90% 56%)`
    : `hsl(${(200 + 60 * t).toFixed(1)} 45% 34%)`;
}

function chainSegments(start, k, maxLen) {
  const segs = [];
  for (let n = start; n + k < points.length; n += k) {
    const a = points[n], b = points[n + k];
    if (Math.hypot(a.x - b.x, a.y - b.y) <= maxLen) segs.push([a, b]);
  }
  return segs;
}

function strokeFamily(k, colour, width) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let j = 0; j < k; j++) {
    for (const [a, b] of chainSegments(j, k, 2.6)) {
      ctx.moveTo(a.x * scale, -a.y * scale);
      ctx.lineTo(b.x * scale, -b.y * scale);
    }
  }
  ctx.stroke();
}

// The spiral through floret n starts along one of its two nearest steps and
// keeps that step while it stays among the nearest ones. Further in the step stops being a
// neighbour (55 hands over to 34, then 21), so the line switches to the close
// neighbour that bends it least, always moving the same way in radius, and
// stops where every choice would bend it by more than about 60 degrees, the
// angle between neighbouring families in a hexagonal packing.
function traceThrough(n, which) {
  const t = turns();
  let k = describeSpirals(Math.max(1, n), t).pair[which];
  const path = [points[n]];
  const k0 = k;
  for (const dir of [1, -1]) {
    let m = n;
    k = k0;
    let next = m + dir * k;
    if (next < 0 || next >= points.length) continue;
    const outward = points[next].r > points[m].r;
    const side = [];
    for (let guard = 0; guard < 400; guard++) {
      const a = points[m], b = points[next];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 3) break;
      side.push(b);
      const dx = b.x - a.x, dy = b.y - a.y;
      m = next;
      next = -1;
      let bestCos = 0.45;
      const near = neighbourSteps(Math.max(1, m), t, 300).slice(0, 8);
      const reach = 1.45 * near[0].d;
      const steps = [k, ...near.map((s) => s.k)];
      for (const [i, s] of steps.entries()) {
        for (const c of [m + s, m - s]) {
          if (c < 0 || c >= points.length) continue;
          const p = points[c];
          if ((p.r > points[m].r) !== outward) continue;
          const ex = p.x - points[m].x, ey = p.y - points[m].y;
          const len = Math.hypot(ex, ey);
          if (len > reach) continue;
          const cos = (ex * dx + ey * dy) / (len * Math.hypot(dx, dy) || 1);
          // Keep the current step when it still runs nearly straight on.
          const score = i === 0 ? cos + 0.08 : cos;
          if (score > bestCos) { bestCos = score; next = c; }
        }
      }
      if (next < 0) break;
      k = Math.abs(next - m);
    }
    if (dir === 1) path.push(...side);
    else path.unshift(...side.reverse());
  }
  return path;
}

function draw() {
  const { w, h } = size();
  if (!w || !points.length) return;
  ctx.save();
  ctx.fillStyle = '#14110c';
  ctx.fillRect(0, 0, w, h);
  const rMax = Math.sqrt(Math.max(1, state.count - 1));
  scale = (0.47 * Math.min(w, h)) / (rMax + 0.8);
  ctx.translate(w / 2, h / 2);

  const shown = Math.min(state.shown, points.length);
  const dot = Math.max(0.6, 0.78 * scale);
  for (let n = 0; n < shown; n++) {
    const p = points[n];
    // Young florets at the centre start small, as on a real head.
    const grow = state.growing ? Math.min(1, (shown - n) / 40) : 1;
    ctx.fillStyle = floretColour(n, p.r, rMax);
    ctx.beginPath();
    ctx.arc(p.x * scale, -p.y * scale, dot * (0.35 + 0.65 * grow), 0, 2 * Math.PI);
    ctx.fill();
  }

  if (state.lines && !state.growing) {
    strokeFamily(rim.pair[0], 'rgba(255, 244, 214, 0.75)', 1.2);
    strokeFamily(rim.pair[1], 'rgba(40, 170, 255, 0.75)', 1.2);
  }

  if (state.selected >= 0 && !state.growing) {
    const colours = ['#ffe9b0', '#8fd0ff'];
    for (const which of [0, 1]) {
      const path = traceThrough(state.selected, which);
      ctx.strokeStyle = colours[which];
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x * scale, -p.y * scale) : ctx.moveTo(p.x * scale, -p.y * scale)));
      ctx.stroke();
    }
    const p = points[state.selected];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x * scale, -p.y * scale, dot + 3, 0, 2 * Math.PI);
    ctx.stroke();
  }

  if (state.numbers && shown <= 600 && scale > 9) {
    ctx.fillStyle = '#0d0b08';
    ctx.font = `${Math.min(11, 0.6 * scale).toFixed(1)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let n = 0; n < shown; n++) ctx.fillText(String(n), points[n].x * scale, -points[n].y * scale);
  }
  ctx.restore();
}

function isLucasPair(a, b) {
  let [x, y] = [1, 3];
  while (x < a) [x, y] = [y, x + y];
  return x === a && y === b;
}

function fmtCF(terms) {
  const [a0, ...rest] = terms;
  if (!rest.length) return `[${a0}]`;
  return `[${a0}; ${rest.join(', ')}${terms.length >= 12 ? ', …' : ''}]`;
}

function updateReadout() {
  const t = turns();
  const frac = t - Math.floor(t);
  const cf = continuedFraction(frac, 12, 1e-7);
  const qs = convergents(cf).map((c) => c.q).filter((q, i, a) => q <= Math.max(state.count, 2) && a.indexOf(q) === i);
  $('r-turns').textContent = frac.toFixed(6);
  $('r-cf').textContent = fmtCF(cf);
  $('r-qs').textContent = qs.join(', ');

  const [a, b] = rim.pair;
  const dirs = rim.winding.map((s) => (s === 'clockwise' ? '↻' : '↺'));
  $('r-pair').textContent = rim.spokes ? `${rim.spokes} arms` : `${a} ${dirs[0]} and ${b} ${dirs[1]}`;
  $('r-ratio').textContent = rim.spokes ? '–' : `${(b / a).toFixed(4)}  (φ = ${PHI.toFixed(4)})`;
  const pack = packing(points);
  $('r-pack').textContent = `${(100 * pack).toFixed(1)}% of hexagonal`;

  let note;
  const miss = Math.abs(rim.spokes * frac - Math.round(rim.spokes * frac)) * 360;
  if (rim.spokes) {
    note = miss < 0.005
      ? `The florets line up on ${rim.spokes} straight spokes: ${rim.spokes} steps of ${state.deg.toFixed(3)}° come back exactly to the start, leaving gaps between them.`
      : `The florets at the rim crowd onto ${rim.spokes} arms: ${rim.spokes} steps of ${state.deg.toFixed(3)}° come back to within ${miss.toFixed(2)}° of the start, so each arm drifts round only slowly.`;
  } else if (rim.fibonacci) {
    note = `${a} and ${b} are consecutive Fibonacci numbers, and they keep climbing the sequence as the head grows.`;
  } else if (isLucasPair(a, b)) {
    note = `${a} and ${b} are consecutive Lucas numbers (1, 3, 4, 7, 11, …): the same rule as Fibonacci from a different start.`;
  } else {
    note = `${a} and ${b} spirals: denominators of fractions close to the angle, read off its continued fraction.`;
  }
  $('pair-note').textContent = note;

  const presetValue = Object.entries(PRESETS).find(([, v]) => Math.abs(v - state.deg) < 5e-4)?.[0]
    ?? [...$('preset').options].find((o) => Math.abs(Number(o.value) - state.deg) < 5e-4)?.value
    ?? 'custom';
  $('preset').value = presetValue;
  const caption = presetValue === 'golden' ? 'golden angle' : presetValue === 'lucas' ? 'Lucas angle' : `${state.deg.toFixed(3)}°`;
  $('caption').textContent = caption;
  $('count-out').textContent = String(state.count);
  canvas.setAttribute('aria-label', `Sunflower head of ${state.count} florets at ${state.deg.toFixed(3)} degrees. ${$('r-pair').textContent} at the rim.`);
  if (state.selected < 0) $('status').textContent = '';
}

function setAngle(deg, from) {
  if (!Number.isFinite(deg)) return;
  state.deg = Math.min(360, Math.max(0, deg));
  if (from !== 'slider') $('angle').value = String(state.deg);
  if (from !== 'number') $('angle-num').value = state.deg.toFixed(3);
  schedule();
}

let pending = false;
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    recompute();
    describeSelected();
  });
}

function describeSelected() {
  if (state.selected < 0) return;
  const d = describeSpirals(Math.max(1, state.selected), turns());
  const [a, b] = d.pair;
  $('status').textContent = `Floret ${state.selected}: its nearest neighbours are ${a} and ${b} places away, so it lies on one of ${a} spirals and one of ${b}. The traced lines follow those two spirals in and out.`;
}

function grow() {
  if (state.growing) return;
  state.selected = -1;
  const start = performance.now();
  const duration = 900 + 2.2 * state.count;
  state.growing = 1;
  const frame = (now) => {
    const t = Math.min(1, (now - start) / duration);
    state.shown = Math.max(1, Math.round(state.count * t * t));
    draw();
    if (t < 1) requestAnimationFrame(frame);
    else {
      state.growing = 0;
      state.shown = state.count;
      draw();
    }
  };
  requestAnimationFrame(frame);
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - rect.width / 2) / scale;
  const y = -(e.clientY - rect.top - rect.height / 2) / scale;
  let best = -1, bestD = 1.2;
  for (let n = 0; n < points.length; n++) {
    const d = Math.hypot(points[n].x - x, points[n].y - y);
    if (d < bestD) { bestD = d; best = n; }
  }
  state.selected = best === state.selected ? -1 : best;
  if (state.selected < 0) $('status').textContent = '';
  describeSelected();
  draw();
});

canvas.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const step = e.shiftKey ? 0.1 : e.altKey ? 0.001 : 0.01;
  setAngle(state.deg + (e.key === 'ArrowRight' ? step : -step));
  e.preventDefault();
});

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey) return;
  if (e.key === ' ') { grow(); e.preventDefault(); }
  else if (e.key === 'g' || e.key === 'G') setAngle(GOLDEN_DEG);
  else if (e.key === 'l' || e.key === 'L') { $('show-lines').checked = !$('show-lines').checked; state.lines = $('show-lines').checked; draw(); }
});

$('angle').addEventListener('input', (e) => setAngle(Number(e.target.value), 'slider'));
$('angle-num').addEventListener('change', (e) => setAngle(Number(e.target.value), 'number'));
$('preset').addEventListener('change', (e) => {
  const v = e.target.value;
  if (v !== 'custom') setAngle(PRESETS[v] ?? Number(v));
});
$('count').addEventListener('input', (e) => {
  state.count = Number(e.target.value);
  state.shown = state.count;
  schedule();
});
$('grow').addEventListener('click', grow);
$('golden').addEventListener('click', () => setAngle(GOLDEN_DEG));
$('colour').addEventListener('change', (e) => { state.colour = e.target.value; draw(); });
$('show-lines').addEventListener('change', (e) => { state.lines = e.target.checked; draw(); });
$('show-numbers').addEventListener('change', (e) => { state.numbers = e.target.checked; draw(); });
$('save').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `florets-${state.deg.toFixed(3)}-${state.count}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
});

window.addEventListener('resize', resize);
$('angle').value = String(state.deg);
$('angle-num').value = state.deg.toFixed(3);
recompute();
resize();
