import { decodeSettings, encodeSettings, clampSettings, presetSettings, PRESETS } from './settings.js';
import { createSim, configure, reset, step, paintWalls, flowTime, wakeReport } from './sim.js';
import { samples } from './shedding.js';
import { liftRange, dragRange, toPoints } from './chart.js';
import { createTracers, rakeRows, release, advect, clearTracers } from './tracers.js';
import { paintField, streakColour } from './render.js';
import { mach, maxReynolds } from './units.js';

const $ = (id) => document.getElementById(id);
const canvas = $('tunnel');
const ctx = canvas.getContext('2d');
const chart = $('forces');
const chartCtx = chart.getContext('2d');
const CHART_WINDOW = 40;

let settings = decodeSettings(location.search);
let sim = null;
let tracers = createTracers(9000);
let rows = [];
let image = null;
let scratch = null;
const field = document.createElement('canvas');
const fieldCtx = field.getContext('2d');

let playing = true;
let painting = null;
let lastPaint = null;
let presetNote = '';
let stepTimes = [];
let frames = 0;

const RE_MIN = 10, RE_MAX = 2000;
const reFromSlider = (v) => RE_MIN * (RE_MAX / RE_MIN) ** (v / 1000);
const sliderFromRe = (re) => Math.round((1000 * Math.log(re / RE_MIN)) / Math.log(RE_MAX / RE_MIN));
const niceRe = (re) => (re < 100 ? Math.round(re) : Math.round(re / 10) * 10);

function build() {
  sim = createSim(settings);
  rows = rakeRows(sim.ny, 16);
  clearTracers(tracers);
  field.width = sim.nx;
  field.height = sim.ny;
  image = fieldCtx.createImageData(sim.nx, sim.ny);
  scratch = new Float32Array(sim.lat.n);
  resize();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const c of [canvas, chart]) {
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
  }
}

function cssColour(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawForces() {
  const W = chart.width, H = chart.height;
  const dpr = W / chart.getBoundingClientRect().width || 1;
  chartCtx.clearRect(0, 0, W, H);
  const { speed: U, size: D } = settings;
  const toFlow = U / D;
  const now = sim.steps * toFlow;
  const { step: st, cd, cl } = samples(sim.history, sim.steps - CHART_WINDOW / toFlow);
  const t = st.map((s) => s * toFlow);
  const span = [Math.max(0, now - CHART_WINDOW), Math.max(CHART_WINDOW, now)];
  const pad = 34 * dpr, gap = 10 * dpr;
  const half = (H - gap) / 2;
  const boxes = [
    { x: pad, y: 4 * dpr, w: W - pad - 6 * dpr, h: half - 8 * dpr, values: cd, range: dragRange(cd), colour: cssColour('--drag') },
    { x: pad, y: half + gap, w: W - pad - 6 * dpr, h: half - 8 * dpr, values: cl, range: liftRange(cl), colour: cssColour('--lift') },
  ];
  chartCtx.font = `${11 * dpr}px system-ui, sans-serif`;
  chartCtx.textAlign = 'right';
  chartCtx.textBaseline = 'middle';
  for (const b of boxes) {
    chartCtx.strokeStyle = cssColour('--line');
    chartCtx.lineWidth = dpr;
    chartCtx.strokeRect(b.x, b.y, b.w, b.h);
    chartCtx.fillStyle = cssColour('--muted');
    chartCtx.fillText(String(b.range[1]), b.x - 4 * dpr, b.y + 6 * dpr);
    chartCtx.fillText(String(b.range[0]), b.x - 4 * dpr, b.y + b.h - 6 * dpr);
    if (b.range[0] < 0 && b.range[1] > 0) {
      const y0 = b.y + b.h * (b.range[1] / (b.range[1] - b.range[0]));
      chartCtx.setLineDash([3 * dpr, 3 * dpr]);
      chartCtx.beginPath();
      chartCtx.moveTo(b.x, y0);
      chartCtx.lineTo(b.x + b.w, y0);
      chartCtx.stroke();
      chartCtx.setLineDash([]);
    }
    const pts = toPoints(t, b.values, b, span, b.range);
    if (pts.length < 2) continue;
    chartCtx.strokeStyle = b.colour;
    chartCtx.lineWidth = 1.5 * dpr;
    chartCtx.beginPath();
    pts.forEach(([x, y], k) => (k ? chartCtx.lineTo(x, y) : chartCtx.moveTo(x, y)));
    chartCtx.stroke();
  }
}

function updateWake() {
  const r = sim.links.length ? wakeReport(sim) : null;
  const dash = '–';
  if (!r) {
    for (const id of ['cd', 'cl', 'period', 'st']) $(id).textContent = dash;
    return;
  }
  const mark = r.settling ? ' (settling)' : '';
  $('cd').textContent = `${r.cd.toFixed(2)}${mark}`;
  $('cl').textContent = `±${r.clAmplitude.toFixed(2)}`;
  if (r.shedding) {
    $('period').textContent = `${((r.period * settings.speed) / settings.size).toFixed(2)} D/U`;
    $('st').textContent = `${r.strouhal.toFixed(3)}${mark}`;
  } else {
    $('period').textContent = 'steady';
    $('st').textContent = dash;
  }
}

function apply(next, { restart = false } = {}) {
  const widthChanged = next.width !== settings.width;
  settings = clampSettings(next);
  if (widthChanged) build();
  else {
    configure(sim, settings, { restart });
    if (restart) clearTracers(tracers);
  }
  syncControls();
}

function syncControls() {
  $('shape').value = settings.shape;
  $('naca').value = settings.naca;
  $('naca-row').hidden = settings.shape !== 'airfoil';
  $('angle').value = settings.angle;
  $('angle-out').textContent = `${settings.angle}°`;
  $('angle').disabled = settings.shape === 'cylinder' || settings.shape === 'none';
  $('size').value = settings.size;
  $('size-out').textContent = `${settings.size} cells`;
  $('re').value = sliderFromRe(settings.re);
  $('re-out').textContent = String(settings.re);
  $('speed').value = settings.speed;
  $('speed-out').textContent = settings.speed.toFixed(2);
  $('width').value = String(settings.width);
  $('view').value = settings.view;
  $('tracers').checked = settings.tracers;
  $('rate').value = settings.rate;
  $('rate-out').textContent = String(settings.rate);

  const r = sim.relax;
  $('re-run').textContent = r.clamped ? `${Math.round(r.re)} (capped)` : String(Math.round(r.re));
  $('tau').textContent = r.tau.toFixed(3);
  $('mach').textContent = mach(settings.speed).toFixed(2);
  $('clamp-note').classList.toggle('warn', r.clamped);
  $('preset-note').textContent = presetNote;
  $('legend').innerHTML = legendFor(settings.view);
}

function legendFor(view) {
  const swatch = (css) => `<span class="swatch" style="background:${css}"></span>`;
  if (view === 'curl') {
    return `Clockwise ${swatch('linear-gradient(90deg,#2152a6,#f6f5f1,#a4202a)')} anticlockwise`;
  }
  if (view === 'speed') {
    return `At rest ${swatch('linear-gradient(90deg,#181236,#2c4080,#227c8e,#38b078,#b0d64c,#fcec78)')} 1.6 × inflow speed`;
  }
  return `Below free-stream pressure ${swatch('linear-gradient(90deg,#2152a6,#f6f5f1,#a4202a)')} above`;
}

function updateTime() {
  const t = flowTime(sim);
  $('time').textContent = `${t.toFixed(1)} D/U`;
}

function draw() {
  paintField(sim, settings.view, image.data, scratch);
  fieldCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(field, 0, 0, canvas.width, canvas.height);
  if (settings.tracers) drawStreaks();
}

function drawStreaks() {
  const sx = canvas.width / (sim.nx - 1);
  const sy = canvas.height / (sim.ny - 1);
  const dot = Math.max(1.5, sx * 0.55);
  for (const parity of [0, 1]) {
    ctx.fillStyle = streakColour(parity);
    for (let i = 0; i < tracers.count; i++) {
      if (tracers.row[i] % 2 !== parity) continue;
      ctx.fillRect(tracers.x[i] * sx - dot / 2, tracers.y[i] * sy - dot / 2, dot, dot);
    }
  }
}

function frame() {
  if (playing) {
    const t0 = performance.now();
    const ok = step(sim, settings.rate);
    if (!ok) {
      clearTracers(tracers);
      setStatus('The run went unstable and was restarted. Try a lower Reynolds number or a slower inflow.', true);
    } else if (settings.tracers) {
      advect(tracers, sim.lat, settings.rate);
      release(tracers, rows, 2);
    }
    stepTimes.push({ t: t0, steps: settings.rate });
    if (stepTimes.length > 30) stepTimes.shift();
    updateTime();
    if (ok && stepTimes.length > 1) {
      const span = (performance.now() - stepTimes[0].t) / 1000;
      const steps = stepTimes.reduce((s, e) => s + e.steps, 0);
      if (performance.now() > stickyUntil) setStatus(`${Math.round(steps / span)} lattice steps per second`);
    }
  }
  draw();
  if (++frames % 6 === 0) {
    drawForces();
    updateWake();
  }
  requestAnimationFrame(frame);
}

let stickyUntil = 0;
function setStatus(text, sticky = false) {
  $('status').textContent = text;
  if (sticky) stickyUntil = performance.now() + 5000;
}

function latticePoint(ev) {
  const rect = canvas.getBoundingClientRect();
  return [
    ((ev.clientX - rect.left) / rect.width) * (sim.nx - 1),
    ((ev.clientY - rect.top) / rect.height) * (sim.ny - 1),
  ];
}

function paintLine(from, to, on) {
  const r = Math.max(1.5, sim.nx / 150);
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.ceil(d / (r / 2)));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    paintWalls(sim, from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, r, on);
  }
}

canvas.addEventListener('pointerdown', (ev) => {
  canvas.setPointerCapture(ev.pointerId);
  const tool = document.querySelector('input[name="tool"]:checked').value;
  painting = { on: tool === 'draw' && !ev.shiftKey };
  lastPaint = latticePoint(ev);
  paintLine(lastPaint, lastPaint, painting.on);
});
canvas.addEventListener('pointermove', (ev) => {
  if (!painting) return;
  const p = latticePoint(ev);
  paintLine(lastPaint, p, painting.on);
  lastPaint = p;
});
const stopPaint = () => {
  painting = null;
  lastPaint = null;
};
canvas.addEventListener('pointerup', stopPaint);
canvas.addEventListener('pointercancel', stopPaint);

$('play').addEventListener('click', () => {
  playing = !playing;
  $('play').textContent = playing ? 'Pause' : 'Play';
  $('play').setAttribute('aria-pressed', String(playing));
});
$('restart').addEventListener('click', () => {
  reset(sim);
  clearTracers(tracers);
  stepTimes = [];
  setStatus('Restarted from the free stream.', true);
});
$('clear-walls').addEventListener('click', () => {
  sim.walls.fill(0);
  configure(sim, settings, { keepWalls: true, restart: false });
});

const numeric = (id, key, parse = Number) =>
  $(id).addEventListener('input', () => {
    presetNote = '';
    apply({ ...settings, [key]: parse($(id).value) });
  });
numeric('angle', 'angle');
numeric('size', 'size');
numeric('speed', 'speed');
numeric('rate', 'rate');
$('re').addEventListener('input', () => {
  presetNote = '';
  apply({ ...settings, re: niceRe(reFromSlider(Number($('re').value))) });
});
$('shape').addEventListener('change', () => {
  presetNote = '';
  apply({ ...settings, shape: $('shape').value });
});
$('naca').addEventListener('change', () => apply({ ...settings, naca: $('naca').value }));
$('width').addEventListener('change', () => apply({ ...settings, width: Number($('width').value) }));
$('view').addEventListener('change', () => apply({ ...settings, view: $('view').value }));
$('tracers').addEventListener('change', () => {
  apply({ ...settings, tracers: $('tracers').checked });
  clearTracers(tracers);
});

for (const p of PRESETS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = p.label;
  b.addEventListener('click', () => {
    const keep = { view: settings.view, tracers: settings.tracers, rate: settings.rate };
    presetNote = p.note;
    const next = { ...presetSettings(p.id), ...keep };
    apply(next, { restart: true });
    sim.walls.fill(0);
    configure(sim, settings, { keepWalls: true, restart: true });
    clearTracers(tracers);
    syncControls();
  });
  $('presets').append(b);
}

$('share').addEventListener('click', async () => {
  const q = encodeSettings(settings);
  const url = `${location.origin}${location.pathname}${q ? `?${q}` : ''}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Share link copied.', true);
  } catch {
    setStatus(`Share link: ${url}`, true);
  }
});
$('png').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `streakline-${settings.shape}-re${Math.round(sim.relax.re)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

const VIEWS = ['curl', 'speed', 'pressure'];
window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
  if (ev.key === ' ') {
    ev.preventDefault();
    $('play').click();
  } else if (ev.key === 'r' || ev.key === 'R') {
    $('restart').click();
  } else if (ev.key === 'v' || ev.key === 'V') {
    apply({ ...settings, view: VIEWS[(VIEWS.indexOf(settings.view) + 1) % VIEWS.length] });
  }
});
window.addEventListener('resize', () => {
  resize();
  drawForces();
});

build();
syncControls();
if (sim.relax.clamped) {
  setStatus(`This size reaches Re ${Math.round(maxReynolds(settings.speed, settings.size))} at most; running there.`, true);
}
requestAnimationFrame(frame);
