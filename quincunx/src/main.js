import { ballPosition, biasSpan, dropMany, layout, rowAt } from './board.js';
import { createFlight, enqueue, step } from './flight.js';
import { barScale, drawScene, landingY } from './render.js';
import { mulberry32, randomSeed } from './rng.js';
import { biasFromX, isUniform, rowBiases } from './patterns.js';
import { decode, encode } from './share.js';
import { binPmf, chiSquareTest, countSummary, pmfMoments, totalVariation } from './stats.js';

const $ = (id) => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');

let settings = decode(location.hash);
let flight;
let pmf;
let biases;
let moments;
let pouring = false;
let L;
let dpr = 1;
let last = performance.now();
let statsDirty = true;

function colours() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  return {
    bg: get('--board'),
    peg: get('--peg'),
    wall: get('--wall'),
    bar: get('--bar'),
    exact: get('--exact'),
    normal: get('--normal'),
    ball: get('--ball'),
    guide: get('--guide'),
    tilt: get('--tilt'),
  };
}
let palette = colours();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  palette = colours();
});

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  L = layout(settings.rows, rect.width, rect.height);
}

const PATTERN_HINTS = {
  same: '',
  alternate: 'Rows take turns leaning one way and the other. The average is fair, yet the pile comes out narrower than a fair board.',
  ramp: 'The chance slides evenly from p at the top row to 1 − p at the bottom.',
  random: 'Each row gets its own chance, fixed by the seed. Empty bins draws a new set.',
  hand: 'Drag across the pegs to set each row: the left edge is 0, the right edge is 1.',
};

function showTicks() {
  return settings.pattern === 'hand' || !isUniform(biases);
}

function rebuild() {
  biases = rowBiases(settings.pattern, settings.rows, settings.p, { seed: settings.seed, custom: settings.custom });
  flight = createFlight(settings.rows, isUniform(biases) ? biases[0] : biases, mulberry32(settings.seed));
  pmf = binPmf(settings.rows, biases);
  moments = pmfMoments(pmf);
  resize();
  statsDirty = true;
  const ticks = showTicks();
  $('tilt-key').hidden = !ticks;
  $('tilt-label').hidden = !ticks;
  canvas.classList.toggle('painting', settings.pattern === 'hand');
}

function syncControls() {
  $('rows').value = settings.rows;
  $('rows-out').textContent = settings.rows;
  $('p').value = settings.p;
  $('p-out').textContent = settings.p.toFixed(2);
  $('show-exact').checked = settings.exact;
  $('show-normal').checked = settings.normal;
  $('pattern').value = settings.pattern;
  $('p').disabled = settings.pattern === 'random' || settings.pattern === 'hand';
  $('pattern-hint').textContent = PATTERN_HINTS[settings.pattern];
}

function writeHash() {
  const h = encode(settings);
  history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
}

const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');

function formatP(p) {
  if (!Number.isFinite(p)) return '–';
  if (p < 0.0001) return 'p < 0.0001';
  return `p = ${p.toFixed(p < 0.01 ? 4 : 2)}`;
}

function updateStats() {
  const s = countSummary(flight.counts);
  $('st-total').textContent = s.total.toLocaleString();
  $('st-mean').textContent = fmt(s.mean);
  $('st-sd').textContent = fmt(s.sd);
  $('st-emean').textContent = fmt(moments.mean);
  $('st-esd').textContent = fmt(moments.sd);
  $('st-tv').textContent = s.total ? fmt(totalVariation(flight.counts, pmf), 3) : '–';
  const chi = s.total >= 20 ? chiSquareTest(flight.counts, pmf) : null;
  const hint = $('chi-hint');
  if (!chi || chi.df === 0) {
    $('st-chi').textContent = '–';
    hint.textContent = s.total < 20 ? 'The fit test starts at 20 balls.' : 'Too few bins with five or more expected balls to test.';
  } else {
    $('st-chi').textContent = `χ² = ${chi.stat.toFixed(1)}, ${formatP(chi.pValue)}`;
    hint.textContent =
      chi.pValue < 0.01
        ? `${chi.df + 1} pooled bins. A p-value this small would be rare if the board were fair to its setting.`
        : `${chi.df + 1} pooled bins. The bins are consistent with the exact distribution.`;
  }
  statsDirty = false;
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const speed = Number($('speed').value);
  if (pouring && flight.queued < 3) enqueue(flight, 3);
  const scale = barScale(L, flight.counts, pmf);
  const landed = step(flight, dt * speed, (b) => ballPosition(L, b.path, b.t, landingY(L, flight.counts, b.bin, scale)).landed);
  if (landed) statsDirty = true;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScene(
    ctx,
    L,
    {
      counts: flight.counts,
      pmf,
      balls: flight.balls,
      showExact: settings.exact,
      showNormal: settings.normal,
      mean: moments.mean,
      sd: moments.sd,
      biases: showTicks() ? biases : null,
    },
    palette,
  );
  if (statsDirty) updateStats();
  requestAnimationFrame(frame);
}

// Up to a hundred balls are animated; bigger drops go straight to the bins.
function drop(n) {
  if (n > 100) dropMany(flight.counts, flight.rows, flight.bias, flight.rng, n);
  else enqueue(flight, n);
  statsDirty = true;
}

function setPouring(on) {
  pouring = on;
  $('pour').setAttribute('aria-pressed', String(on));
  $('pour').textContent = on ? 'Stop pouring' : 'Pour';
}

function emptyBins() {
  settings = { ...settings, seed: randomSeed() };
  writeHash();
  rebuild();
}

for (const btn of document.querySelectorAll('[data-drop]')) {
  btn.addEventListener('click', () => drop(Number(btn.dataset.drop)));
}
$('pour').addEventListener('click', () => setPouring(!pouring));
$('clear').addEventListener('click', emptyBins);

$('rows').addEventListener('input', () => {
  settings = { ...settings, rows: Number($('rows').value) };
  $('rows-out').textContent = settings.rows;
  writeHash();
  rebuild();
});
$('p').addEventListener('input', () => {
  settings = { ...settings, p: Number($('p').value) };
  $('p-out').textContent = settings.p.toFixed(2);
  writeHash();
  rebuild();
});
$('pattern').addEventListener('change', () => {
  const pattern = $('pattern').value;
  // Painting starts from whatever the board showed a moment ago.
  settings = { ...settings, pattern, custom: pattern === 'hand' ? biases.slice() : [] };
  syncControls();
  writeHash();
  rebuild();
});

let lastPaintRow = -1;
function paint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const row = rowAt(L, y);
  if (row < 0) return;
  const { left, right } = biasSpan(L);
  const value = biasFromX(x, left, right);
  const custom = biases.slice();
  // Fill any rows skipped by a quick drag.
  const from = lastPaintRow < 0 ? row : lastPaintRow;
  const lo = Math.min(from, row);
  const hi = Math.max(from, row);
  for (let r = lo; r <= hi; r++) custom[r] = value;
  lastPaintRow = row;
  settings = { ...settings, custom };
  rebuild();
}

canvas.addEventListener('pointerdown', (e) => {
  if (settings.pattern !== 'hand') return;
  canvas.setPointerCapture(e.pointerId);
  lastPaintRow = -1;
  paint(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (settings.pattern === 'hand' && canvas.hasPointerCapture(e.pointerId)) paint(e);
});
const endPaint = () => {
  if (lastPaintRow >= 0) writeHash();
  lastPaintRow = -1;
};
canvas.addEventListener('pointerup', endPaint);
canvas.addEventListener('pointercancel', endPaint);

$('show-exact').addEventListener('change', () => {
  settings = { ...settings, exact: $('show-exact').checked };
  writeHash();
});
$('show-normal').addEventListener('change', () => {
  settings = { ...settings, normal: $('show-normal').checked };
  writeHash();
});

function say(text) {
  $('status').textContent = text;
}

$('share').addEventListener('click', async () => {
  writeHash();
  try {
    await navigator.clipboard.writeText(location.href);
    say('Link copied.');
  } catch {
    say('Copy the address bar to share this board.');
  }
});

$('png').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quincunx-${settings.rows}rows-p${settings.p.toFixed(2)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const counts = { 1: 1, 2: 10, 3: 100, 4: 1000 };
  if (e.key === ' ') {
    e.preventDefault();
    setPouring(!pouring);
  } else if (counts[e.key]) {
    drop(counts[e.key]);
  } else if (e.key === 'c' || e.key === 'C') {
    emptyBins();
  }
});

window.addEventListener('hashchange', () => {
  settings = decode(location.hash);
  syncControls();
  rebuild();
});

window.addEventListener('resize', resize);

syncControls();
rebuild();
drop(1);
requestAnimationFrame(frame);
