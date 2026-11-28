import {
  TOY, rpmToRad, floorAngle, criticalSpin, radToRpm, steadyPrecession, constants,
  turningPoints, classify, nodding, thetaAccel, bodyTilt, bodySpin, constantsFromBody,
} from './top.js';
import { createRun } from './run.js';
import {
  rpmLabel, angleLabel, pushLabel, seconds, perSecond, shapeLabel, describe, fallStory, frictionNote, nowLabel,
} from './readout.js';
import { drawTop, drawPath, drawPotential, drawHistory } from './draw.js';

const $ = (id) => document.getElementById(id);
const controls = { rpm: $('rpm'), tilt: $('tilt'), push: $('push') };
const topCanvas = $('top-canvas');
const pathCanvas = $('path-canvas');
const potCanvas = $('pot-canvas');
const historyCanvas = $('history');
const HISTORY_POINTS = 6000;
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
  // Friction is set by how long the spin would last: a steady couple I3 omega / life.
  const life = Number($('friction').value);
  const friction = life ? (TOY.I3 * omega3) / life : 0;
  const run = createRun(release, TOY, FLOOR, band.touches, friction);
  motion = { rpm, tilt, push, c, band, kind, nod, steady, run, life, trail3: [], trail2: [], history: [] };
  record(run.state);

  $('rpm-value').textContent = rpmLabel(rpm);
  $('tilt-value').textContent = angleLabel(tilt);
  $('push-value').textContent = steady || push === 0 ? pushLabel(push) : `${pushLabel(push)} (measured against m g l / I3 ω, as no steady cone exists at this spin)`;
  $('r-shape').textContent = shapeLabel(kind, band.touches);
  $('r-band').textContent = band.touches
    ? `${angleLabel(band.thetaMin)} and the table, which it reaches at ${angleLabel(FLOOR)}`
    : kind === 'steady' ? `it does not nod: the tilt stays at ${angleLabel(tilt)}` : `${angleLabel(band.thetaMin, band.thetaMin < Math.PI / 180 ? 2 : 1)} and ${angleLabel(band.thetaMax, 1)}`;
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
    rises: thetaAccel(tilt, c) < 0,
    precessionPeriod: (2 * Math.PI) / Math.abs(nod.precessionRate),
  }) + (band.touches ? '' : frictionNote(life));
  $('status').textContent = '';
  draw();
}

function record(s) {
  motion.trail3.push(s.e3.map((v) => v * TOY.height * 1.6));
  motion.trail2.push([bodyTilt(s), Math.atan2(s.e3[1], s.e3[0])]);
  const h = motion.history;
  if (!h.length || s.t - h[h.length - 1][0] >= 0.004 || motion.run.fell) {
    h.push([s.t, bodyTilt(s), (bodySpin(s) * 60) / (2 * Math.PI)]);
    // Past the cap, keep every other point so the whole run stays on the chart.
    if (h.length > HISTORY_POINTS) motion.history = h.filter((_, i) => i % 2 === 0 || i === h.length - 1);
  }
  if (motion.trail3.length > TRAIL_POINTS) {
    motion.trail3.shift();
    motion.trail2.shift();
  }
}

function advance(simSeconds) {
  const { run } = motion;
  run.advance(simSeconds, record);
  if (run.fell) {
    $('status').textContent = fallStory(run.state.t, FLOOR, radToRpm(bodySpin(run.state)));
    setRunning(false);
  }
}

function draw() {
  const m = motion;
  // With friction the walls move as the spin dies, so the energy picture and
  // the band follow the present state; without it they never change.
  let { c, band } = m;
  if (m.life && m.run.state.t > 0) {
    c = constantsFromBody(m.run.state, TOY);
    band = turningPoints(c);
    band.touches = band.thetaMax >= FLOOR;
  }
  drawTop(topCanvas.getContext('2d'), topCanvas.width, topCanvas.height, m.run.state, TOY, m.trail3, palette);
  drawPath(pathCanvas.getContext('2d'), pathCanvas.width, m.trail2, band, FLOOR, palette);
  drawPotential(potCanvas.getContext('2d'), potCanvas.width, potCanvas.height, c, band, bodyTilt(m.run.state), FLOOR, palette);
  drawHistory(historyCanvas.getContext('2d'), historyCanvas.width, historyCanvas.height, m.history, FLOOR, radToRpm(criticalSpin()), m.rpm, palette);
  $('r-now').textContent = nowLabel(m.run.state.t, radToRpm(bodySpin(m.run.state)), bodyTilt(m.run.state));
}

function setRunning(on) {
  running = on && !motion.run.fell;
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

for (const el of [...Object.values(controls), $('friction')]) {
  el.addEventListener('input', () => {
    // A fallen top starts again with the new setting; a paused one stays paused.
    const resume = running || motion.run.fell;
    setUp();
    setRunning(resume);
  });
}
$('run').addEventListener('click', () => {
  if (motion.run.fell) setUp();
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
    $('friction').value = b.dataset.friction;
    if (b.dataset.speed) $('speed').value = b.dataset.speed;
    setUp();
    setRunning(true);
  });
}

setUp();
setRunning(running);
requestAnimationFrame(frame);
