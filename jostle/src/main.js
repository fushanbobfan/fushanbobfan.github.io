import { createGas, kineticEnergy, packingFraction } from './gas.js';
import { step, createGrid, safeStep } from './physics.js';
import {
  speedHistogram, blendHistogram, boltzmannH, maxwellH, ksDistance, characteristicSpeeds,
  idealPressure, hendersonZ, createPressureMeter, recordPressure, meterReading,
  createHistory, pushHistory,
} from './stats.js';
import {
  boxView, drawGas, histogramGeometry, drawHistogram, seriesGeometry, drawSeries,
  msdGeometry, drawMsd,
} from './render.js';
import {
  createTrajectory, recordPosition, logLags, meanSquaredDisplacement, fitDiffusion, diffusiveOnset,
  usefulLag,
} from './diffusion.js';
import { decodeSettings, encodeSettings, clampSettings, capacity } from './settings.js';
import { randomSeed } from './rng.js';

const BINS = 30;
const TRAIL = 700;
const H_POINTS = 360;
// Simulated time per real second at rate 1 and kT = 1: a typical disk
// crosses the box in about six seconds.
const TIME_PER_SECOND = 13;
const MAX_SUBSTEPS = 240;
// Tracer positions are kept every half time unit, the last 4000 of them.
const SAMPLE_EVERY = 0.5;
const SAMPLES = 4000;

const $ = (id) => document.getElementById(id);
const boxCanvas = $('box');
const histCanvas = $('hist');
const hCanvas = $('hchart');
const msdCanvas = $('msd');

let settings = decodeSettings(location.hash);
let gas;
let grid;
let e0;
let trail = [];
let hHistory = createHistory(H_POINTS);
let hNow = 0;
let hAvg = null;
let meter;
let traj;
let running = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = 0;

function theme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    box: v('--box'), wall: v('--muted'), trail: v('--accent'), disk: v('--muted'),
    ink: v('--ink'), bar: v('--bar'), curve: v('--curve'), axis: v('--line'), muted: v('--muted'),
  };
}

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: width, h: height };
}

function rebuild() {
  gas = createGas({
    n: settings.n, radius: settings.radius, kT: settings.kT, start: settings.start, seed: settings.seed,
    tracer: settings.tracer ? { mass: settings.tracerMass, radius: settings.tracerRadius } : null,
  });
  gas.tag = new Uint8Array(gas.n);
  for (let i = 0; i < gas.n; i++) gas.tag[i] = gas.x[i] < gas.width / 2 ? 0 : 1;
  grid = createGrid(gas);
  e0 = kineticEnergy(gas);
  trail = [[gas.x[0], gas.y[0]]];
  hHistory = createHistory(H_POINTS);
  hAvg = null;
  meter = createPressureMeter(40);
  traj = createTrajectory(SAMPLE_EVERY, SAMPLES);
  recordPosition(traj, gas.time, gas.x[0], gas.y[0]);
  sampleH();
  draw();
}

function vmax() {
  return 4 * Math.sqrt(settings.kT);
}

// The speed statistics describe the unit-mass gas, so a tracer is left out.
function gasOnly() {
  return gas.tracer ? (i) => i > 0 : null;
}

function sampleH() {
  const hist = speedHistogram(gas, BINS, vmax(), gasOnly());
  hNow = boltzmannH(hist);
  pushHistory(hHistory, hNow);
  hAvg = blendHistogram(hAvg, hist, 0.8);
}

function advance(seconds) {
  const target = seconds * TIME_PER_SECOND * settings.rate / Math.sqrt(settings.kT);
  const dt = safeStep(gas, 0.25);
  const n = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(target / dt)));
  const h = target / n;
  for (let k = 0; k < n; k++) {
    const { impulse } = step(gas, Math.min(h, dt), grid);
    recordPressure(meter, impulse, Math.min(h, dt));
    if (gas.tracer) recordPosition(traj, gas.time, gas.x[0], gas.y[0]);
  }
  if (settings.trace) {
    trail.push([gas.x[0], gas.y[0]]);
    if (trail.length > TRAIL) trail.shift();
  }
  sampleH();
}

function format(v, digits = 3) {
  if (!Number.isFinite(v)) return '–';
  return v.toLocaleString('en-US', { maximumSignificantDigits: digits });
}

function draw() {
  const t = theme();
  const { kT } = settings;
  const speeds = characteristicSpeeds(1, kT);

  const b = fitCanvas(boxCanvas);
  b.ctx.clearRect(0, 0, b.w, b.h);
  drawGas(b.ctx, gas, boxView(gas, b.w, b.h), {
    colouring: settings.colour, vmp: speeds.mostProbable, theme: t, trail: settings.trace ? trail : null,
  });

  const hc = fitCanvas(histCanvas);
  hc.ctx.clearRect(0, 0, hc.w, hc.h);
  const hist = hAvg || speedHistogram(gas, BINS, vmax(), gasOnly());
  drawHistogram(hc.ctx, histogramGeometry(hist, 1, kT, hc.w, hc.h), hist, t);

  const floor = maxwellH(1, kT, BINS, vmax());
  const hSeries = hHistory.values;
  const lo = floor - 0.15;
  const hi = Math.max(floor + 0.3, ...hSeries) + 0.05;
  const g = fitCanvas(hCanvas);
  g.ctx.clearRect(0, 0, g.w, g.h);
  const pts = seriesGeometry(hSeries, lo, hi, g.w, g.h);
  const floorY = seriesGeometry([floor, floor], lo, hi, g.w, g.h)[0][1];
  drawSeries(g.ctx, pts, floorY, t, 34, g.w - 8);

  let sum = 0;
  const first = gas.tracer ? 1 : 0;
  for (let i = first; i < gas.n; i++) sum += Math.hypot(gas.vx[i], gas.vy[i]);
  $('ks').textContent = format(ksDistance(gas, 1, kT, gasOnly()), 2);
  $('mean').textContent = format(sum / (gas.n - first));
  if (gas.tracer) drawTracer(t);
  $('mean-theory').textContent = format(speeds.mean);
  $('h-now').textContent = format(hNow);
  $('h-floor').textContent = format(floor);

  const eta = packingFraction(gas);
  const ideal = idealPressure(gas.n, kT, gas.width, gas.height);
  const wall = meterReading(meter, gas.width, gas.height);
  const ready = meter.samples.length > 0;
  $('z-wall').textContent = ready ? format(wall / ideal) : '–';
  $('z-henderson').textContent = format(hendersonZ(eta));
  $('p-wall').textContent = ready ? format(wall) : '–';
  $('eta').textContent = format(eta, 2);
  $('hits').textContent = gas.collisions.toLocaleString('en-US');
  const drift = (kineticEnergy(gas) - e0) / e0;
  $('drift').textContent = Math.abs(drift) < 1e-9 ? 'below 1e-9' : `${format(drift * 100, 2)}%`;
  $('status').textContent = `t = ${format(gas.time, 4)} · ${gas.n} disks · kT = ${kT}`;
}

function drawTracer(t) {
  const m = fitCanvas(msdCanvas);
  m.ctx.clearRect(0, 0, m.w, m.h);
  const pts = meanSquaredDisplacement(traj, logLags(usefulLag(traj)));
  const onset = diffusiveOnset(pts, settings.kT, settings.tracerMass);
  const fit = Number.isFinite(onset) ? fitDiffusion(pts, onset) : null;
  const geom = msdGeometry(pts, settings.kT, settings.tracerMass, fit, m.w, m.h);
  if (geom) drawMsd(m.ctx, geom, t);
  $('d-fit').textContent = fit && fit.D > 0 ? format(fit.D) : 'collecting';
  $('onset').textContent = Number.isFinite(onset) ? `τ ≈ ${format(onset, 2)}` : 'not yet';
  $('record').textContent = `${format((traj.x.length - 1) * SAMPLE_EVERY, 3)} t`;
}

function frame(now) {
  const seconds = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (running) {
    advance(seconds);
    draw();
  }
  requestAnimationFrame(frame);
}

function syncControls() {
  for (const key of ['n', 'radius', 'kT', 'rate', 'tracerMass', 'tracerRadius']) {
    $(key).value = settings[key];
    $(`${key}-out`).textContent = key === 'rate' ? `${settings.rate}×` : settings[key];
  }
  $('n').max = capacity(settings.radius, 100, 100, settings.tracer ? settings.tracerRadius : 0);
  $('tracer').checked = settings.tracer;
  $('tracer-controls').hidden = !settings.tracer;
  $('start').value = settings.start;
  $('colour').value = settings.colour;
  $('trace').checked = settings.trace;
  $('play').textContent = running ? 'Pause' : 'Play';
  $('play').setAttribute('aria-pressed', String(running));
}

function update(patch, restart) {
  settings = clampSettings({ ...settings, ...patch });
  history.replaceState(null, '', `#${encodeSettings(settings)}`);
  syncControls();
  if (restart) rebuild();
  else draw();
}

function togglePlay() {
  running = !running;
  syncControls();
}

for (const key of ['n', 'radius', 'kT', 'tracerMass', 'tracerRadius']) {
  $(key).addEventListener('input', (e) => update({ [key]: Number(e.target.value) }, true));
}
$('rate').addEventListener('input', (e) => update({ rate: Number(e.target.value) }, false));
$('start').addEventListener('change', (e) => update({ start: e.target.value }, true));
$('colour').addEventListener('change', (e) => update({ colour: e.target.value }, false));
$('trace').addEventListener('change', (e) => {
  trail = [[gas.x[0], gas.y[0]]];
  update({ trace: e.target.checked }, false);
});
$('tracer').addEventListener('change', (e) => update({ tracer: e.target.checked }, true));
$('play').addEventListener('click', togglePlay);
$('step').addEventListener('click', () => { advance(1 / 30); draw(); });
$('restart').addEventListener('click', rebuild);
$('reseed').addEventListener('click', () => update({ seed: randomSeed() }, true));
$('share').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('status').textContent = 'Share link copied.';
  } catch {
    $('status').textContent = location.href;
  }
});
$('png').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `jostle-${settings.seed}.png`;
  a.href = boxCanvas.toDataURL('image/png');
  a.click();
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 's' || e.key === 'S') { advance(1 / 30); draw(); }
  else if (e.key === 'r' || e.key === 'R') rebuild();
  else if (e.key === 'n' || e.key === 'N') update({ seed: randomSeed() }, true);
});
window.addEventListener('hashchange', () => {
  settings = decodeSettings(location.hash);
  syncControls();
  rebuild();
});
window.addEventListener('resize', draw);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);

syncControls();
rebuild();
requestAnimationFrame((t) => { last = t; frame(t); });
