import {
  createPile, index, addGrains, relax, sweep, isStable, setCells, totalGrains, THRESHOLD,
} from './sandpile.js';
import { createTracker, dropGrain, siteRandom } from './avalanche.js';
import { createHistogram, record, reset as resetHistogram, densities, fitSlope } from './stats.js';
import { drawChart } from './chart.js';
import {
  PALETTES, paletteWords, rampWords, logStep,
} from './palette.js';
import {
  MODES, VIEWS, SPECS, DEFAULTS, clampParam, encodeParams, decodeParams, towerSide,
} from './params.js';

const canvas = document.getElementById('pile');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const playBtn = document.getElementById('play');
const modeSelect = document.getElementById('mode');
const modeNote = document.getElementById('mode-note');
const paletteSelect = document.getElementById('palette');
const viewSelect = document.getElementById('view');
const viewNote = document.getElementById('view-note');
const legendEl = document.getElementById('legend');
const chart = document.getElementById('chart');
const chartCtx = chart.getContext('2d');
const chartNote = document.getElementById('chart-note');
const avalancheBox = document.getElementById('avalanche-box');
const inputs = {
  power: document.getElementById('power'),
  size: document.getElementById('size'),
  speed: document.getElementById('speed'),
};
const outputs = {
  power: document.getElementById('power-value'),
  size: document.getElementById('size-value'),
  seed: document.getElementById('seed-value'),
  speed: document.getElementById('speed-value'),
};
const rows = {
  power: document.getElementById('power-row'),
  size: document.getElementById('size-row'),
  seed: document.getElementById('seed-row'),
};

const NOTES = {
  tower: 'All the grains start on the centre cell. The collapse spreads into a square-ish disc with an intricate, self-similar interior.',
  rain: 'Grains land one at a time on random cells, and the pile settles completely between drops. It fills up until it sits right at the edge of stability.',
  identity: 'Three grains everywhere is doubled, settled and subtracted from the doubled pile, then that settles in turn. The result is the one recurrent pile that, added to any other and settled, leaves it unchanged.',
};

const state = {
  params: { ...DEFAULTS },
  pile: null,
  tracker: null,
  rand: null,
  hist: createHistogram(5),
  words: paletteWords(DEFAULTS.palette),
  ramp: rampWords(DEFAULTS.palette),
  odoMax: 0,
  running: true,
  stepOnce: false,
  phase: '',
  dropped: 0,
  topplings: 0,
  flashGen: 0,
  lastSize: 0,
  image: null,
  offscreen: document.createElement('canvas'),
  chartDirty: true,
};

// Scene set-up ------------------------------------------------------------

function sideFor(params) {
  return params.mode === 'tower' ? towerSide(2 ** params.power) : params.size;
}

function restart() {
  const { params } = state;
  const side = sideFor(params);
  state.pile = createPile(side, side);
  state.tracker = createTracker(state.pile);
  state.rand = siteRandom(params.seed);
  resetHistogram(state.hist);
  state.dropped = 0;
  state.topplings = 0;
  state.lastSize = 0;
  state.flashGen = 0;
  state.chartDirty = true;
  state.offscreen.width = side;
  state.offscreen.height = side;
  state.image = state.offscreen.getContext('2d').createImageData(side, side);

  if (params.mode === 'tower') {
    const c = (side - 1) / 2;
    addGrains(state.pile, index(state.pile, c, c), 2 ** params.power);
    state.phase = 'collapse';
  } else if (params.mode === 'identity') {
    setCells(state.pile, new Uint32Array(side * side).fill(2 * (THRESHOLD - 1)));
    state.phase = 'double';
  } else {
    state.phase = 'rain';
  }
  syncControls();
  resize();
}

// One unit of work per speed step: a sweep pass for towers and the
// identity, one dropped grain for rain.
function workPerFrame() {
  return 2 ** (clampSpeed(inputs.speed.value) - 1);
}

function clampSpeed(v) {
  return Math.min(12, Math.max(1, Math.round(Number(v)) || 6));
}

function advance(units) {
  const { pile } = state;
  if (state.phase === 'rain') {
    if (!isStable(pile)) state.topplings += relax(pile).topplings;
    for (let k = 0; k < units; k++) {
      const r = dropGrain(pile, state.rand(pile.cells.length), state.tracker);
      record(state.hist, r.size);
      state.dropped += 1;
      state.topplings += r.size;
      if (r.size > 0) {
        state.lastSize = r.size;
        state.flashGen = state.tracker.gen;
      }
    }
    state.chartDirty = true;
    return;
  }
  if (isStable(pile)) return;
  const r = sweep(pile, units);
  state.topplings += r.topplings;
  if (r.stable && state.phase === 'double') {
    // Second half of the identity recipe: 2m - stab(2m), then settle again.
    const twice = 2 * (THRESHOLD - 1);
    setCells(pile, pile.cells.map((h) => twice - h));
    state.phase = 'identity';
  }
}

// Drawing -----------------------------------------------------------------

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

// Square area the grid is drawn into, in canvas pixels.
function viewBox() {
  const side = state.pile.width;
  const scale = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / side));
  const px = Math.min(canvas.width, canvas.height) >= side ? side * scale : Math.min(canvas.width, canvas.height);
  return {
    x: Math.floor((canvas.width - px) / 2),
    y: Math.floor((canvas.height - px) / 2),
    size: px,
  };
}

function draw() {
  const out = new Uint32Array(state.image.data.buffer);
  if (state.params.view === 'topplings') drawOdometer(out);
  else drawGrains(out);
  present();
}

// Each cell on a log scale from never toppled to the busiest cell.
function drawOdometer(out) {
  const { odometer } = state.pile;
  const { ramp } = state;
  let max = 0;
  for (let i = 0; i < odometer.length; i++) if (odometer[i] > max) max = odometer[i];
  state.odoMax = max;
  for (let i = 0; i < odometer.length; i++) out[i] = ramp[logStep(odometer[i], max, ramp.length)];
}

function drawGrains(out) {
  const { pile, words, tracker } = state;
  const { cells } = pile;
  // Light up only the most recent avalanche: at hundreds of drops per frame,
  // lighting every toppled cell would wash out the whole grid.
  const flash = state.phase === 'rain' && state.flashGen > 0 ? state.flashGen : -1;
  for (let i = 0; i < cells.length; i++) {
    const h = cells[i];
    if (h >= THRESHOLD) out[i] = words[4];
    else if (tracker.mark[i] === flash) out[i] = words[4];
    else out[i] = words[h];
  }
}

function present() {
  state.offscreen.getContext('2d').putImageData(state.image, 0, 0);
  ctx.fillStyle = cssVar('--bg');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const box = viewBox();
  ctx.drawImage(state.offscreen, box.x, box.y, box.size, box.size);
}

function drawAvalanches() {
  if (!state.chartDirty) return;
  state.chartDirty = false;
  const pts = densities(state.hist);
  const largest = state.hist.largest;
  const fit = fitSlope(pts, { from: 3, to: Math.max(30, largest / 20), minCount: 10 });
  drawChart(chartCtx, pts, fit, {
    muted: cssVar('--muted'), grid: cssVar('--panel-border'), fit: cssVar('--focus'), point: cssVar('--accent'),
  });
  if (state.hist.total === 0) {
    chartNote.textContent = 'Switch the experiment to Rain to collect avalanches.';
  } else {
    const quiet = ((100 * state.hist.zeros) / state.hist.total).toFixed(1);
    const slope = fit ? `, fitted slope ${fit.slope.toFixed(2)}` : '';
    chartNote.textContent = `${fmt(state.hist.total)} drops, ${quiet}% caused no toppling, largest ${fmt(largest)}${slope}`;
  }
}

function updateStatus() {
  const { pile } = state;
  const grains = totalGrains(pile);
  const density = (grains / pile.cells.length).toFixed(3);
  const settled = isStable(pile);
  let text;
  if (state.phase === 'rain') {
    text = `${fmt(state.dropped)} grains dropped · latest avalanche ${fmt(state.lastSize)} topplings · ${density} grains per cell · ${fmt(pile.lost)} fell off`;
  } else if (state.phase === 'collapse') {
    text = `${settled ? 'Settled' : 'Toppling'}: ${fmt(2 ** state.params.power)} grains on a ${pile.width}×${pile.width} grid · ${fmt(state.topplings)} topplings`;
  } else if (state.phase === 'double') {
    text = `Settling six grains per cell · ${fmt(state.topplings)} topplings`;
  } else {
    text = `${settled ? 'Identity' : 'Settling the difference'} of the ${pile.width}×${pile.width} sandpile group · ${fmt(state.topplings)} topplings`;
  }
  if (state.params.view === 'topplings') text += ` · busiest cell toppled ${fmt(state.odoMax)} times`;
  statusEl.textContent = text;
}

function fmt(n) {
  return Number(n).toLocaleString('en-US');
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
}

function frame() {
  resize();
  if (state.running || state.stepOnce) {
    advance(state.stepOnce && !state.running ? 1 : workPerFrame());
    state.stepOnce = false;
  } else if (!isStable(state.pile)) {
    // Grains dropped by hand while paused still settle.
    state.topplings += relax(state.pile, 20000).topplings;
  }
  draw();
  drawAvalanches();
  updateStatus();
  requestAnimationFrame(frame);
}

// Controls ----------------------------------------------------------------

function syncControls() {
  const { params } = state;
  modeSelect.value = params.mode;
  paletteSelect.value = params.palette;
  viewSelect.value = params.view;
  inputs.power.value = params.power;
  inputs.size.value = params.size;
  outputs.power.textContent = `2^${params.power} = ${fmt(2 ** params.power)} grains`;
  outputs.size.textContent = `${params.size} cells`;
  outputs.seed.textContent = String(params.seed);
  outputs.speed.textContent = speedLabel();
  rows.power.hidden = params.mode !== 'tower';
  rows.size.hidden = params.mode === 'tower';
  rows.seed.hidden = params.mode !== 'rain';
  avalancheBox.hidden = params.mode !== 'rain';
  modeNote.textContent = NOTES[params.mode];
  drawLegend();
}

function speedLabel() {
  const n = workPerFrame();
  return state.params.mode === 'rain' ? `${fmt(n)} grains per frame` : `${fmt(n)} passes per frame`;
}

const VIEW_NOTES = {
  grains: '',
  topplings: 'Brightness follows the logarithm of how many times each cell has toppled since the experiment started. In Identity it counts the second settling stage only.',
};

function drawLegend() {
  const p = PALETTES[state.params.palette];
  viewNote.textContent = VIEW_NOTES[state.params.view];
  viewNote.hidden = !VIEW_NOTES[state.params.view];
  if (state.params.view === 'topplings') {
    legendEl.replaceChildren(legendItem(p.colors[0], 'never toppled'), legendItem(p.colors[3], 'toppled most'));
    return;
  }
  const names = ['empty', '1 grain', '2 grains', '3 grains', state.params.mode === 'rain' ? 'latest avalanche' : 'toppling'];
  legendEl.replaceChildren(...[...p.colors, p.hot].map((c, i) => legendItem(c, names[i])));
}

function legendItem(color, text) {
  const li = document.createElement('li');
  const sw = document.createElement('span');
  sw.className = 'swatch';
  sw.style.background = color;
  li.append(sw, text);
  return li;
}

function setParam(name, value) {
  state.params[name] = clampParam(name, value);
}

function setRunning(on) {
  state.running = on;
  playBtn.textContent = on ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-pressed', String(on));
}

for (const [key, label] of Object.entries(MODES)) modeSelect.add(new Option(label, key));
for (const [key, p] of Object.entries(PALETTES)) paletteSelect.add(new Option(p.label, key));
for (const [key, label] of Object.entries(VIEWS)) viewSelect.add(new Option(label, key));

modeSelect.addEventListener('change', () => { setParam('mode', modeSelect.value); restart(); });
inputs.power.addEventListener('input', () => { setParam('power', inputs.power.value); restart(); });
inputs.size.addEventListener('input', () => { setParam('size', inputs.size.value); restart(); });
inputs.speed.addEventListener('input', () => { outputs.speed.textContent = speedLabel(); });
document.getElementById('reseed').addEventListener('click', () => {
  setParam('seed', 1 + Math.floor(Math.random() * SPECS.seed.max));
  restart();
});
paletteSelect.addEventListener('change', () => {
  setParam('palette', paletteSelect.value);
  state.words = paletteWords(state.params.palette);
  state.ramp = rampWords(state.params.palette);
  drawLegend();
});
viewSelect.addEventListener('change', () => {
  setParam('view', viewSelect.value);
  drawLegend();
});
playBtn.addEventListener('click', () => setRunning(!state.running));
document.getElementById('step').addEventListener('click', () => { setRunning(false); state.stepOnce = true; });
document.getElementById('restart').addEventListener('click', restart);

document.getElementById('copy-link').addEventListener('click', async (e) => {
  const url = `${location.origin}${location.pathname}#${encodeParams(state.params)}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    e.target.textContent = 'Copied';
  } catch {
    e.target.textContent = 'Link in address bar';
  }
  setTimeout(() => { e.target.textContent = 'Copy link'; }, 1500);
});

document.getElementById('save').addEventListener('click', () => {
  const side = state.pile.width;
  const scale = Math.max(1, Math.floor(1024 / side));
  const out = document.createElement('canvas');
  out.width = side * scale;
  out.height = side * scale;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(state.offscreen, 0, 0, out.width, out.height);
  const a = document.createElement('a');
  a.download = `topple-${state.params.mode}-${side}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
});

// Dropping grains by hand.
let painting = false;

function dropAt(event) {
  const rect = canvas.getBoundingClientRect();
  const dpr = canvas.width / rect.width;
  const box = viewBox();
  const cell = box.size / state.pile.width;
  const x = Math.floor(((event.clientX - rect.left) * dpr - box.x) / cell);
  const y = Math.floor(((event.clientY - rect.top) * dpr - box.y) / cell);
  if (x < 0 || y < 0 || x >= state.pile.width || y >= state.pile.height) return;
  addGrains(state.pile, index(state.pile, x, y), 1);
}

canvas.addEventListener('pointerdown', (e) => {
  painting = true;
  canvas.setPointerCapture(e.pointerId);
  dropAt(e);
});
canvas.addEventListener('pointermove', (e) => { if (painting) dropAt(e); });
canvas.addEventListener('pointerup', () => { painting = false; });
canvas.addEventListener('pointercancel', () => { painting = false; });

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === ' ') { e.preventDefault(); setRunning(!state.running); }
  else if (e.key === 'n' || e.key === 'N') { setRunning(false); state.stepOnce = true; }
  else if (e.key === 'r' || e.key === 'R') restart();
});

const fromLink = decodeParams(location.hash);
if (fromLink) state.params = fromLink;
state.words = paletteWords(state.params.palette);
state.ramp = rampWords(state.params.palette);
restart();
requestAnimationFrame(frame);
