import {
  G, EARTH_SPIN, localSpin, precessionPeriod, degreesPerHour, swingPeriod, solve, release,
  planeAngle, wrapHalf,
} from './pendulum.js';
import { pinRing, knock, fallTime, pinOffset } from './pins.js';
import { duration, hours, latitude } from './format.js';
import { Sand, drawScene, layout, toFloor } from './view.js';
import { drawGlobe, drawSheet } from './cone-view.js';
import { tangentCone, turnedAfter } from './cone.js';
import { spinVector, start as startFull, airyRate, apsides, turnRate } from './spherical.js';
import { drawTurnChart } from './short-view.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const globe = $('globe'), sheet = $('sheet'), swChart = $('sw-chart');

const PIN_COUNT = 36, PIN_RADIUS = 0.96, REACH = 0.04;
const FADE_SWINGS = 60; // the track fades over about this many swings
const SAND = 'rgba(233,210,166,0.5)';

const state = {
  lat: 48.8462,
  length: 67,
  mode: 'rest',
  factor: 1,
  speed: 1000,
  view: 'floor',
  sandOn: true,
  pinsOn: true,
  direction: Math.PI / 2,
  paused: false,
};

let run = null;
let pendingFade = 0;
const sand = new Sand();

function placeName() {
  const opt = [...$('place').options].find((o) => o.selected && o.value !== 'custom');
  return opt ? opt.textContent : latitude(state.lat);
}

function start() {
  const omegaZ = localSpin(state.lat, state.factor);
  const set = release(state.mode, 1, state.length, G, omegaZ, state.direction);
  const motion = solve({ length: state.length, omegaZ, ...set });
  const plane = planeAngle(motion, omegaZ, state.length);
  run = {
    omegaZ,
    motion,
    plane,
    plane0: plane(0),
    T: swingPeriod(state.length),
    t: 0,
    bob: motion(0),
    pins: pinRing(PIN_COUNT, PIN_RADIUS, wrapHalf(state.direction)),
    lastFall: null,
  };
  sand.clear();
  pendingFade = 0;
  state.paused = false;
  $('pause').textContent = 'Pause';
  $('pause').append(kbd('P'));
  updateStatic();
  updateLive();
  draw();
}

function kbd(text) {
  const k = document.createElement('kbd');
  k.textContent = text;
  return k;
}

function advance(dtSim) {
  const r = run;
  const t0 = r.t, t1 = t0 + dtSim;
  const n = Math.min(6000, Math.max(1, Math.ceil((dtSim / r.T) * 64)));
  const pts = [r.bob];
  let prev = r.bob;
  for (let i = 1; i <= n; i++) {
    const t = t0 + (dtSim * i) / n;
    const m = r.motion(t);
    const fell = knock(r.pins, prev.x, prev.y, m.x, m.y, REACH, t);
    if (fell.length) r.lastFall = { count: fell.length, at: t };
    pts.push(m);
    prev = m;
  }
  r.t = t1;
  r.bob = prev;
  pendingFade += 1 - Math.exp(-dtSim / (r.T * FADE_SWINGS));
  if (pendingFade >= 0.06) {
    sand.fade(pendingFade);
    pendingFade = 0;
  }
  sand.stroke(pts, SAND);
}

function rotation() {
  return state.view === 'plane' ? run.omegaZ * run.t : 0;
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  drawScene(ctx, rect.width, rect.height, {
    rot: rotation(),
    sand: state.sandOn ? sand : null,
    pins: state.pinsOn ? run.pins : null,
    plane0: run.plane0,
    planeNow: run.plane(run.t),
    bob: run.bob,
  });
  drawExplain();
}

// fraction of the (possibly spun-up) day since release, as the trip round the parallel
function dayFraction() {
  const turns = (EARTH_SPIN * state.factor * run.t) / (2 * Math.PI);
  return turns - Math.floor(turns);
}

function drawExplain() {
  const f = dayFraction();
  for (const [c, fn] of [[globe, drawGlobe], [sheet, drawSheet]]) {
    const rect = c.getBoundingClientRect();
    fn(c.getContext('2d'), rect.width, rect.height, state.lat, f);
  }
}

function updateConeNote() {
  const cone = tangentCone(state.lat);
  const turned = (Math.abs(turnedAfter(state.lat, dayFraction())) * 180) / Math.PI;
  const sector = (cone.sector * 180) / Math.PI;
  const trip = `${Math.floor(100 * dayFraction())}% of the way round`;
  $('cone-note').textContent = cone.kind === 'cylinder'
    ? `At the equator the cone becomes a cylinder, which unrolls into a strip: north points the same way all along it, so the swing never turns. ${trip}.`
    : `At ${latitude(state.lat)} the flat sheet spans ${sector.toFixed(1)}°. ${trip}, north has turned ${turned.toFixed(1)}° past the swing; ` +
      `seen from the floor the swing has turned ${turned.toFixed(1)}° ${state.lat > 0 ? 'clockwise' : 'anticlockwise'} since this day began.`;
}

function updateStatic() {
  const dph = degreesPerHour(state.lat);
  const turnReal = precessionPeriod(state.lat);
  const turnModel = precessionPeriod(state.lat, state.factor);
  const T = swingPeriod(state.length);
  $('lat-out').textContent = latitude(state.lat);
  $('len-out').textContent = `${state.length} m`;
  $('caption').textContent = placeName();
  $('r-rate').textContent = Math.abs(dph) < 1e-9
    ? 'not at all'
    : `${Math.abs(dph).toFixed(2)}° an hour, ${dph > 0 ? 'clockwise' : 'anticlockwise'} from above`;
  $('r-turn').textContent = `${hours(turnReal)}${state.factor > 1 ? `, ${hours(turnModel)} spun up` : ''}`;
  $('r-page').textContent = Number.isFinite(turnModel) ? duration(turnModel / state.speed) : 'never';
  $('r-swing').textContent = `${T.toFixed(2)} s there and back`;
  $('r-swings').textContent = Number.isFinite(turnModel) ? Math.round(turnModel / T).toLocaleString('en') : 'endless';
  $('view-note').textContent = state.view === 'plane'
    ? 'This frame turns with the local vertical spin, Ω sin φ. The floor turns under a swing that keeps its line.'
    : 'Fixed to the floor, as a visitor stands. The swing turns.';
}

function updateLive() {
  const r = run;
  updateConeNote();
  const down = r.pins.filter((p) => p.down).length;
  $('r-time').textContent = duration(r.t);
  $('r-turned').textContent = `${((Math.abs(r.omegaZ) * r.t * 180) / Math.PI).toFixed(1)}°`;
  $('r-pins').textContent = `${down} of ${r.pins.length}`;
  let next = Infinity;
  if (Math.abs(r.omegaZ) > 1e-15) {
    for (const p of r.pins) {
      if (p.down) continue;
      next = Math.min(next, fallTime(pinOffset(p, r.plane0, r.omegaZ), PIN_RADIUS, REACH, r.omegaZ) - r.t);
    }
  }
  $('r-next').textContent = down === r.pins.length ? 'all down' : Number.isFinite(next) ? `in ${duration(next)}` : 'never';
  if (r.lastFall) {
    const what = r.lastFall.count > 1 ? `${r.lastFall.count} pins fell` : 'A pin fell';
    $('status').textContent = `${what} ${duration(r.lastFall.at)} after release.`;
  } else {
    $('status').textContent = state.paused ? 'Paused.' : '';
  }
}

// Short wires: the full pendulum over two hours of the real Earth's turn.
const SHORT = { length: 2, ampShare: 0.1, slip: 0.01, duration: 7200, result: null };

function runShort() {
  const L = SHORT.length, a = SHORT.ampShare * L, b = SHORT.slip * a;
  const om = spinVector(state.lat);
  const { apsides: points } = apsides(startFull(L, a, b), { L, om, duration: SHORT.duration, stepsPerSwing: 80 });
  const foucault = -localSpin(state.lat);
  // Airy's turn goes the way the bob goes round: clockwise (falling angle) for a positive slip
  const airy = -Math.sign(b) * airyRate(L, a, Math.abs(b));
  SHORT.result = { points, foucault, predicted: foucault + airy, airy, measured: turnRate(points) };
  updateShort();
  drawShort();
}

const perHour = (rate) => {
  const d = (-rate * 3600 * 180) / Math.PI;
  if (Math.abs(d) < 0.005) return '0° an hour';
  return `${Math.abs(d).toFixed(2)}° an hour ${d > 0 ? 'clockwise' : 'anticlockwise'}`;
};

function updateShort() {
  $('sw-len-out').textContent = `${SHORT.length} m`;
  $('sw-amp-out').textContent = `${Math.round(100 * SHORT.ampShare)}% of the wire, ${fmtLength(SHORT.ampShare * SHORT.length)}`;
  const r = SHORT.result;
  if (!r) return;
  $('sw-earth').textContent = perHour(r.foucault);
  $('sw-airy').textContent = perHour(r.airy);
  $('sw-measured').textContent = perHour(r.measured);
  const share = Math.abs(r.airy) / Math.abs(r.foucault || 1);
  $('sw-note').textContent = Math.abs(r.foucault) < 1e-12
    ? "At the equator the Earth adds nothing; any turn is Airy's."
    : SHORT.slip === 0
      ? 'A flat release has no ellipse to turn: the full pendulum follows the Earth alone.'
      : share >= 1
        ? `Airy's turn is ${share.toFixed(1)} times the Earth's: this pendulum mostly shows how it was let go.`
        : `Airy's turn is ${(100 * share).toFixed(share < 0.1 ? 1 : 0)}% of the Earth's.`;
}

function fmtLength(m) {
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(m < 10 ? 1 : 0)} m`;
}

function drawShort() {
  if (!SHORT.result) return;
  const rect = swChart.getBoundingClientRect();
  drawTurnChart(swChart.getContext('2d'), rect.width, rect.height, { ...SHORT.result, duration: SHORT.duration });
}

$('sw-len').addEventListener('input', (e) => { SHORT.length = Number(e.target.value); updateShort(); });
$('sw-amp').addEventListener('input', (e) => { SHORT.ampShare = Number(e.target.value) / 100; updateShort(); });
$('sw-len').addEventListener('change', runShort);
$('sw-amp').addEventListener('change', runShort);
$('sw-slip').addEventListener('change', (e) => { SHORT.slip = Number(e.target.value); runShort(); });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (run && !state.paused) {
    advance(dt * state.speed);
    updateLive();
    draw();
  }
  requestAnimationFrame(frame);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  for (const c of [canvas, globe, sheet, swChart]) {
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (run) draw();
  drawShort();
}

function setLatitude(lat, fromPreset = false) {
  state.lat = Math.max(-90, Math.min(90, lat));
  $('lat').value = state.lat;
  if (!fromPreset) {
    const match = [...$('place').options].find((o) => o.value !== 'custom' && Math.abs(Number(o.value) - state.lat) < 0.05);
    $('place').value = match ? match.value : 'custom';
  }
  start();
  scheduleShort();
}

let shortTimer = 0;
function scheduleShort() {
  clearTimeout(shortTimer);
  shortTimer = setTimeout(runShort, 200);
}

function togglePause() {
  state.paused = !state.paused;
  $('pause').textContent = state.paused ? 'Resume' : 'Pause';
  $('pause').append(kbd('P'));
  updateLive();
}

$('place').addEventListener('change', (e) => {
  if (e.target.value !== 'custom') setLatitude(Number(e.target.value), true);
});
$('lat').addEventListener('input', (e) => setLatitude(Number(e.target.value)));
$('len').addEventListener('input', (e) => { state.length = Number(e.target.value); start(); });
$('mode').addEventListener('change', (e) => { state.mode = e.target.value; start(); });
$('spin').addEventListener('change', (e) => { state.factor = Number(e.target.value); start(); });
$('speed').addEventListener('change', (e) => { state.speed = Number(e.target.value); updateStatic(); });
$('view').addEventListener('change', (e) => { state.view = e.target.value; updateStatic(); draw(); });
$('sand').addEventListener('change', (e) => { state.sandOn = e.target.checked; draw(); });
$('show-pins').addEventListener('change', (e) => { state.pinsOn = e.target.checked; draw(); });
$('go').addEventListener('click', start);
$('pause').addEventListener('click', togglePause);

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const L = layout(rect.width, rect.height);
  const p = toFloor(L, rotation(), e.clientX - rect.left, e.clientY - rect.top);
  if (Math.hypot(p.x, p.y) < 0.05) return;
  state.direction = Math.atan2(p.y, p.x);
  start();
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); start(); }
  else if (e.key === 'p' || e.key === 'P') togglePause();
  else if (e.target === canvas && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    setLatitude(Math.round(state.lat + (e.key === 'ArrowRight' ? step : -step)));
  }
});

window.addEventListener('resize', resize);
$('lat').value = state.lat;
resize();
start();
runShort();
requestAnimationFrame(frame);
