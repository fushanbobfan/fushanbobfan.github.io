import { createLattice, openFraction } from './lattice.js';
import { labelClusters, summarise } from './clusters.js';
import { BOND_THRESHOLD, SITE_THRESHOLD, addTrial, createAccumulator, summariseSweep, sweepLattice, trialSeed } from './sweep.js';
import { COLOURINGS, PALETTES, gridDimensions, paintGrid, siteAtPixel } from './render.js';
import { SIZES, decode, encode, normalise } from './share.js';
import { barsPath, histogram, linePath } from './chart.js';
import { randomSeed } from './rng.js';

const $ = (id) => document.getElementById(id);
const canvas = $('grid');
const ctx = canvas.getContext('2d');
const buffer = document.createElement('canvas');
const bufferCtx = buffer.getContext('2d');

const PLOT = { width: 220, height: 140 };
const SWEEP_BINS = 201;

let settings = decode(location.hash);
let lat = null;
let own = null; // this grid's own threshold and largest-cluster curve
let result = null;
let stats = null;
let hovered = -1;
let frame = 0;
let sweep = null;

const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const threshold = () => (settings.mode === 'site' ? SITE_THRESHOLD : BOND_THRESHOLD);

function rebuild() {
  lat = createLattice({ size: settings.size, mode: settings.mode, seed: settings.seed });
  own = sweepLattice(lat, SWEEP_BINS);
  hovered = -1;
  relabel();
}

function relabel() {
  result = labelClusters(lat, settings.p);
  stats = summarise(result);
  if (hovered >= result.clusters.length) hovered = -1;
  schedule();
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw);
}

function fitCanvas() {
  const { width } = gridDimensions(lat);
  const css = canvas.getBoundingClientRect().width || 600;
  const k = Math.max(1, Math.floor((css * (window.devicePixelRatio || 1)) / width));
  if (canvas.width !== width * k) {
    canvas.width = width * k;
    canvas.height = width * k;
  }
}

function draw() {
  frame = 0;
  const img = paintGrid(lat, settings.p, result, {
    colouring: settings.colouring,
    palette: PALETTES[settings.palette],
    highlight: hovered,
  });
  buffer.width = img.width;
  buffer.height = img.height;
  bufferCtx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  fitCanvas();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  showText();
  drawChart();
}

function describeSpan(s) {
  if (s.spansVertical && s.spansHorizontal) return 'a cluster spans the grid both ways';
  if (s.spansVertical) return 'a cluster joins top to bottom';
  if (s.spansHorizontal) return 'a cluster joins left to right';
  return 'no cluster spans the grid';
}

function showText() {
  const s = stats;
  const kind = settings.mode === 'site' ? 'site' : 'bond';
  $('p-out').textContent = fmt(settings.p);
  $('status').textContent =
    `${lat.size} × ${lat.size} ${kind} grid at p = ${fmt(settings.p)}: ${s.count.toLocaleString()} clusters, ` +
    `the largest holds ${pct(s.largestFraction)} of the ${settings.mode === 'site' ? 'cells' : 'sites'}; ${describeSpan(s)}.`;
  canvas.setAttribute('aria-label', `Percolation grid. ${$('status').textContent}`);

  const rows = [
    [settings.mode === 'site' ? 'Open cells' : 'Open links', pct(openFraction(lat, settings.p))],
    ['Clusters', s.count.toLocaleString()],
    ['Largest cluster', `${s.largest.toLocaleString()} (${pct(s.largestFraction)})`],
    ['Spanning', s.spans ? `yes, ${s.spanningSize.toLocaleString()} ${settings.mode === 'site' ? 'cells' : 'sites'}` : 'no'],
    ['Mean finite cluster', fmt(s.meanFiniteSize, 1)],
    ["This grid's threshold", fmt(own.threshold, 4)],
    ['Infinite-grid threshold', settings.mode === 'site' ? '≈ 0.5927' : '1/2 exactly'],
  ];
  const dl = $('stats');
  dl.replaceChildren(...rows.flatMap(([k, v]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    return [dt, dd];
  }));

  if (hovered >= 0) {
    const c = result.clusters[hovered];
    const where = c.spans ? ', spanning the grid' : '';
    $('probe').textContent = `Cluster ${hovered + 1} of ${result.clusters.length}: ${c.size.toLocaleString()} ${settings.mode === 'site' ? 'cells' : 'sites'}${where}.`;
  } else {
    $('probe').textContent = 'Point at a cluster to see its size.';
  }
}

function drawAxes() {
  const g = $('chart-grid');
  const ns = 'http://www.w3.org/2000/svg';
  const parts = [];
  const line = (x1, y1, x2, y2) => {
    const el = document.createElementNS(ns, 'line');
    Object.entries({ x1, y1, x2, y2, class: 'axis' }).forEach(([k, v]) => el.setAttribute(k, v));
    parts.push(el);
  };
  const text = (x, y, s, anchor) => {
    const el = document.createElementNS(ns, 'text');
    Object.entries({ x, y, class: 'tick', 'text-anchor': anchor }).forEach(([k, v]) => el.setAttribute(k, v));
    el.textContent = s;
    parts.push(el);
  };
  line(30, 150, 250, 150);
  line(30, 10, 30, 150);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    text(30 + t * PLOT.width, 162, String(t), 'middle');
    text(26, 153 - t * PLOT.height, String(t), 'end');
  }
  text(140, 170, 'p', 'middle');
  g.replaceChildren(...parts);
}

function drawChart() {
  const x = (p) => (p * PLOT.width).toFixed(1);
  $('chart-p').setAttribute('x1', x(settings.p));
  $('chart-p').setAttribute('x2', x(settings.p));
  $('chart-pc').setAttribute('x1', x(threshold()));
  $('chart-pc').setAttribute('x2', x(threshold()));
  const ps = Array.from({ length: SWEEP_BINS }, (_, b) => b / (SWEEP_BINS - 1));
  if (sweep && sweep.acc.trials) {
    const s = summariseSweep(sweep.acc);
    $('chart-span').setAttribute('d', linePath(s.p, s.spanning, PLOT));
    $('chart-largest').setAttribute('d', linePath(s.p, s.largest, PLOT));
    $('chart-hist').setAttribute('d', barsPath(histogram(sweep.acc.thresholds, 100), PLOT));
  } else {
    // Before any sweep, show this grid alone: a step at its threshold.
    $('chart-span').setAttribute('d', linePath(ps, ps.map((p) => (own.threshold < p ? 1 : 0)), PLOT));
    $('chart-largest').setAttribute('d', linePath(ps, Array.from(own.largest), PLOT));
    $('chart-hist').setAttribute('d', '');
  }
}

function showSweep(done) {
  const s = summariseSweep(sweep.acc);
  const kind = sweep.mode === 'site' ? 'site' : 'bond';
  const known = sweep.mode === 'site' ? '0.5927' : '0.5';
  const state = done ? '' : ' (running)';
  $('sweep-out').textContent =
    `${s.trials} ${sweep.size} × ${sweep.size} ${kind} grids${state}: thresholds average ${fmt(s.mean, 4)} ± ${fmt(s.stderr, 4)} ` +
    `(spread ${fmt(s.sd, 3)}); the infinite grid's is ${known}. Larger grids give a narrower spread and a sharper step.`;
}

function startSweep() {
  stopSweep();
  const trials = Number($('trials').value);
  sweep = {
    mode: settings.mode,
    size: settings.size,
    seed: randomSeed(),
    trials,
    next: 0,
    acc: createAccumulator(SWEEP_BINS),
    timer: 0,
  };
  $('sweep').disabled = true;
  $('sweep-stop').disabled = false;
  const step = () => {
    const start = performance.now();
    while (sweep.next < sweep.trials && performance.now() - start < 30) {
      const grid = createLattice({ size: sweep.size, mode: sweep.mode, seed: trialSeed(sweep.seed, sweep.next) });
      addTrial(sweep.acc, sweepLattice(grid, SWEEP_BINS));
      sweep.next++;
    }
    const done = sweep.next >= sweep.trials;
    showSweep(done);
    drawChart();
    if (done) finishSweep();
    else sweep.timer = setTimeout(step, 0);
  };
  step();
}

function finishSweep() {
  $('sweep').disabled = false;
  $('sweep-stop').disabled = true;
}

function stopSweep() {
  if (sweep && sweep.timer) {
    clearTimeout(sweep.timer);
    sweep.timer = 0;
    showSweep(true);
  }
  finishSweep();
}

function clearSweep() {
  stopSweep();
  sweep = null;
  $('sweep-out').textContent = '';
}

function saveHash() {
  const hash = encode(settings);
  history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
}

function update(patch) {
  const before = settings;
  settings = normalise({ ...settings, ...patch });
  syncControls();
  saveHash();
  const gridChanged = before.mode !== settings.mode || before.size !== settings.size || before.seed !== settings.seed;
  if (before.mode !== settings.mode || before.size !== settings.size) clearSweep();
  if (gridChanged) rebuild();
  else if (before.p !== settings.p) relabel();
  else schedule();
}

function syncControls() {
  document.querySelectorAll('input[name="mode"]').forEach((el) => { el.checked = el.value === settings.mode; });
  $('size').value = String(settings.size);
  $('seed').value = String(settings.seed);
  $('p').value = String(settings.p);
  $('colouring').value = settings.colouring;
  $('palette').value = settings.palette;
}

function hoverAt(event) {
  const rect = canvas.getBoundingClientRect();
  const { width } = gridDimensions(lat);
  const px = Math.floor(((event.clientX - rect.left) / rect.width) * width);
  const py = Math.floor(((event.clientY - rect.top) / rect.height) * width);
  const site = siteAtPixel(lat, px, py);
  const k = site >= 0 ? result.label[site] : -1;
  if (k !== hovered) {
    hovered = k;
    schedule();
  }
}

function savePng() {
  const { width } = gridDimensions(lat);
  const k = Math.max(1, Math.ceil(1024 / width));
  const out = document.createElement('canvas');
  out.width = width * k;
  out.height = width * k;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  const img = paintGrid(lat, settings.p, result, { colouring: settings.colouring, palette: PALETTES[settings.palette] });
  buffer.width = img.width;
  buffer.height = img.height;
  bufferCtx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  octx.drawImage(buffer, 0, 0, out.width, out.height);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seepage-${settings.mode}-${settings.size}-p${fmt(settings.p)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  schedule();
}

function bind() {
  $('size').replaceChildren(...SIZES.map((n) => new Option(`${n} × ${n}`, String(n))));
  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.addEventListener('change', () => update({ mode: el.value }));
  });
  $('size').addEventListener('change', () => update({ size: Number($('size').value) }));
  $('seed').addEventListener('change', () => update({ seed: Number($('seed').value) }));
  $('p').addEventListener('input', () => update({ p: Number($('p').value) }));
  $('colouring').addEventListener('change', () => update({ colouring: $('colouring').value }));
  $('palette').addEventListener('change', () => update({ palette: $('palette').value }));
  $('reseed').addEventListener('click', () => update({ seed: randomSeed() }));
  $('to-threshold').addEventListener('click', () => update({ p: Math.floor(own.threshold * 1000 + 1) / 1000 }));
  $('sweep').addEventListener('click', startSweep);
  $('sweep-stop').addEventListener('click', stopSweep);
  $('save-png').addEventListener('click', savePng);
  $('copy-link').addEventListener('click', async () => {
    saveHash();
    try {
      await navigator.clipboard.writeText(location.href);
      $('copy-link').textContent = 'Copied';
    } catch {
      $('copy-link').textContent = 'Copy failed';
    }
    setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1500);
  });

  canvas.addEventListener('pointermove', hoverAt);
  canvas.addEventListener('pointerleave', () => { hovered = -1; schedule(); });
  canvas.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.01 : 0.001;
    const key = event.key.toLowerCase();
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') update({ p: settings.p + step });
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') update({ p: settings.p - step });
    else if (key === 't') update({ p: Math.floor(own.threshold * 1000 + 1) / 1000 });
    else if (key === 'n') update({ seed: randomSeed() });
    else if (key === 'b') update({ mode: settings.mode === 'site' ? 'bond' : 'site' });
    else if (key === 'c') update({ colouring: COLOURINGS[(COLOURINGS.indexOf(settings.colouring) + 1) % COLOURINGS.length] });
    else return;
    event.preventDefault();
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', () => update(decode(location.hash)));
}

bind();
drawAxes();
syncControls();
rebuild();
