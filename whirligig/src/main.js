import {
  TOY, rpmToRad, floorAngle, criticalSpin, radToRpm, steadyPrecession, constants, initialState,
  step, turningPoints, classify, nodding,
} from './top.js';
import {
  rpmLabel, angleLabel, pushLabel, seconds, perSecond, shapeLabel, describe, fallStory,
} from './readout.js';
import { drawTop, drawPath, drawPotential, bodyAxes } from './draw.js';

const $ = (id) => document.getElementById(id);
const controls = { rpm: $('rpm'), tilt: $('tilt'), push: $('push') };
const topCanvas = $('top-canvas');
const pathCanvas = $('path-canvas');
const potCanvas = $('pot-canvas');
const FLOOR = floorAngle(TOY);
const TRAIL_POINTS = 2400;

let motion = null;
let running = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function colours() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    ink: v('--ink'), muted: v('--muted'), rule: v('--rule'), trail: v('--trail'), warn: v('--warn'),
    band: v('--band'), shadow: v('--shadow'), body: v('--body'), bodyEdge: v('--body-edge'),
    stripe: v('--stripe'), stripe2: v('--stripe2'), steel: v('--steel'),
  };
}
let palette = colours();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  palette = colours();
  draw();
});

function setUp() {
  const rpm = Number(controls.rpm.value);
  const tilt = (Number(controls.tilt.value) * Math.PI) / 180;
  const push = Number(controls.push.value);
  const omega3 = rpmToRad(rpm);
  const steady = steadyPrecession(tilt, omega3);
  const ref = steady ? steady.slow : TOY.mgl / (TOY.I3 * omega3);
  const release = { theta: tilt, phiDot: push * ref, omega3 };
  const c = constants(release);
  const band = turningPoints(c);
  band.touches = band.thetaMax >= FLOOR;
  const kind = classify(c, band);
  const nod = nodding(c, band);
  // Small enough steps for a few hundred per nod, whatever the spin.
  const h = Math.min(2e-4, nod.period / 400);
  motion = { rpm, tilt, push, c, band, kind, nod, steady, h, state: initialState(release), fell: false, trail3: [], trail2: [] };
  record();

  $('rpm-value').textContent = rpmLabel(rpm);
  $('tilt-value').textContent = angleLabel(tilt);
  $('push-value').textContent = steady || push === 0 ? pushLabel(push) : `${pushLabel(push)} (measured against m g l / I3 ω, as no steady cone exists at this spin)`;
  $('r-shape').textContent = shapeLabel(kind, band.touches);
  $('r-band').textContent = band.touches
    ? `${angleLabel(band.thetaMin)} and the table, which it reaches at ${angleLabel(FLOOR)}`
    : kind === 'steady' ? `it does not nod: the tilt stays at ${angleLabel(tilt)}` : `${angleLabel(band.thetaMin, 1)} and ${angleLabel(band.thetaMax, 1)}`;
  $('r-nod').textContent = band.touches || kind === 'steady' ? '—' : `${seconds(nod.period)} (${perSecond(nod.period)})`;
  $('r-prec').textContent = band.touches ? '—' : seconds((2 * Math.PI) / Math.abs(nod.precessionRate));
  const est = (2 * Math.PI * TOY.I3 * omega3) / TOY.mgl;
  $('r-est').textContent = `${seconds(est)} (2π I3 ω / m g l, good when the spin is fast)`;
  $('r-steady').textContent = steady
    ? `once every ${seconds((2 * Math.PI) / steady.slow)} (slow), or every ${seconds((2 * Math.PI) / steady.fast)} (fast)`
    : 'none: the spin is too slow for any steady cone at this tilt';
  $('r-critical').textContent = `${Math.round(radToRpm(criticalSpin())).toLocaleString('en-US')} rpm or more`;
  $('story').textContent = describe({
    kind, thetaMin: band.thetaMin, thetaMax: band.thetaMax, tilt, floor: FLOOR, touches: band.touches, push,
    precessionPeriod: (2 * Math.PI) / Math.abs(nod.precessionRate),
  });
  $('status').textContent = '';
  draw();
}

function record() {
  const s = motion.state;
  const { e3 } = bodyAxes(s.theta, s.phi, 0);
  motion.trail3.push(e3.map((v) => v * TOY.height * 1.6));
  motion.trail2.push([s.theta, s.phi]);
  if (motion.trail3.length > TRAIL_POINTS) {
    motion.trail3.shift();
    motion.trail2.shift();
  }
}

function advance(simSeconds) {
  const m = motion;
  const n = Math.min(Math.ceil(simSeconds / m.h), 20000);
  const every = Math.max(1, Math.floor(n / 24));
  for (let i = 0; i < n && !m.fell; i++) {
    m.state = step(m.state, m.c, m.h);
    if (m.state.theta >= FLOOR) {
      m.fell = true;
      m.state = { ...m.state, theta: FLOOR, thetaDot: 0 };
      $('status').textContent = fallStory(m.state.t, FLOOR);
      setRunning(false);
    }
    if (i % every === 0 || m.fell) record();
  }
}

function draw() {
  const m = motion;
  drawTop(topCanvas.getContext('2d'), topCanvas.width, topCanvas.height, m.state, TOY, m.trail3, palette);
  drawPath(pathCanvas.getContext('2d'), pathCanvas.width, m.trail2, m.band, FLOOR, palette);
  drawPotential(potCanvas.getContext('2d'), potCanvas.width, potCanvas.height, m.c, m.band, m.state.theta, FLOOR, palette);
}

function setRunning(on) {
  running = on && !motion.fell;
  $('run').textContent = running ? 'Pause' : 'Play';
}

let last = null;
function frame(now) {
  if (last !== null && running) {
    const dt = Math.min((now - last) / 1000, 0.05);
    advance(dt * Number($('speed').value));
    draw();
  }
  last = now;
  requestAnimationFrame(frame);
}

for (const el of Object.values(controls)) {
  el.addEventListener('input', () => {
    // A fallen top starts again with the new setting; a paused one stays paused.
    const resume = running || motion.fell;
    setUp();
    setRunning(resume);
  });
}
$('run').addEventListener('click', () => {
  if (motion.fell) setUp();
  setRunning(!running);
});
$('restart').addEventListener('click', () => {
  setUp();
  setRunning(true);
});
for (const b of document.querySelectorAll('button[data-rpm]')) {
  b.addEventListener('click', () => {
    controls.rpm.value = b.dataset.rpm;
    controls.tilt.value = b.dataset.tilt;
    controls.push.value = b.dataset.push;
    setUp();
    setRunning(true);
  });
}

setUp();
setRunning(running);
requestAnimationFrame(frame);
