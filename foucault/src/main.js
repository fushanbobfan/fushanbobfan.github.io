import {
  G, localSpin, precessionPeriod, degreesPerHour, swingPeriod, solve, release,
  planeAngle, wrapHalf,
} from './pendulum.js';
import { pinRing, knock, fallTime, pinOffset } from './pins.js';
import { duration, hours, latitude } from './format.js';
import { Sand, drawScene, layout, toFloor } from './view.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

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
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (run) draw();
}

function setLatitude(lat, fromPreset = false) {
  state.lat = Math.max(-90, Math.min(90, lat));
  $('lat').value = state.lat;
  if (!fromPreset) {
    const match = [...$('place').options].find((o) => o.value !== 'custom' && Math.abs(Number(o.value) - state.lat) < 0.05);
    $('place').value = match ? match.value : 'custom';
  }
  start();
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
requestAnimationFrame(frame);
