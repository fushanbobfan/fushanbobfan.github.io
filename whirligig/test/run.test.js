import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOY, floorAngle, rpmToRad, steadyPrecession, constants, turningPoints, nodding, integrate,
  bodyState, bodyStep, bodyStepSize, bodyTilt, bodyEnergy,
} from '../src/top.js';
import { createRun } from '../src/run.js';

const deg = Math.PI / 180;
const FLOOR = floorAngle();

function release(rpm, tiltDeg, push) {
  const omega3 = rpmToRad(rpm);
  const theta = tiltDeg * deg;
  const sp = steadyPrecession(theta, omega3);
  const ref = sp ? sp.slow : TOY.mgl / (TOY.I3 * omega3);
  return { theta, phiDot: push * ref, omega3 };
}

const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];

test('the vector form keeps energy and both angular momenta', () => {
  const rel = release(1400, 17, 2.5);
  let s = bodyState(rel);
  const E0 = bodyEnergy(s);
  const Lz0 = s.L[2];
  const L30 = dot(s.L, s.e3);
  const h = bodyStepSize(s);
  for (let i = 0; i < 2 / h; i++) s = bodyStep(s, h);
  assert.ok(Math.abs(bodyEnergy(s) - E0) / E0 < 1e-9);
  assert.ok(Math.abs(s.L[2] - Lz0) / Math.abs(Lz0) < 1e-9);
  assert.ok(Math.abs(dot(s.L, s.e3) - L30) / L30 < 1e-9);
  assert.ok(Math.abs(dot(s.e1, s.e3)) < 1e-12);
});

test('a nod that passes close to upright stays inside its band', () => {
  // The axle comes within about 0.01 degrees of upright here; stepping the
  // Euler angles at a fixed rate once reported a false fall.
  for (const [rpm, tilt, push] of [[1400, 17, 2.5], [1300, 3, 1.95], [5000, 2, 2.5]]) {
    const rel = release(rpm, tilt, push);
    const tp = turningPoints(constants(rel));
    assert.ok(tp.thetaMax < FLOOR);
    const run = createRun(rel, TOY, FLOOR, false);
    let lo = Infinity;
    let hi = -Infinity;
    run.advance(3, (s) => {
      lo = Math.min(lo, bodyTilt(s));
      hi = Math.max(hi, bodyTilt(s));
    }, 1e9, 1e9);
    assert.equal(run.fell, false, `${rpm} ${tilt} ${push}`);
    assert.ok(hi <= tp.thetaMax + 1e-6 && lo >= tp.thetaMin - 1e-5, `${rpm} ${tilt} ${push}: ${lo} ${hi}`);
  }
});

test('the mean precession is right when the nod passes close to upright', () => {
  for (const [rpm, tilt, push] of [[1300, 3, 1.95], [1400, 17, 2.5], [2000, 25, 0]]) {
    const rel = release(rpm, tilt, push);
    const nod = nodding(constants(rel));
    // Unwrapped direction of the axle from the vector integration.
    let s = bodyState(rel);
    const h = Math.min(bodyStepSize(s), 5e-6);
    let prev = Math.atan2(s.e3[1], s.e3[0]);
    let phi = 0;
    const T = 40 * nod.period;
    for (let i = 0; i < T / h; i++) {
      s = bodyStep(s, h);
      const now = Math.atan2(s.e3[1], s.e3[0]);
      let d = now - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      phi += d;
      prev = now;
    }
    // Over 40 nods the leftover partial nod adds at most one nod's turn.
    const measured = phi / s.t;
    assert.ok(Math.abs(measured - nod.precessionRate) <= Math.abs(nod.turn) / s.t + 1e-6, `${rpm} ${tilt} ${push}: ${measured} vs ${nod.precessionRate}`);
  }
});

test('adaptive integration finds a narrow peak', () => {
  const w = 1e-4;
  const f = (x) => w / (Math.PI * ((x - 0.3) ** 2 + w * w));
  const exact = (Math.atan((1 - 0.3) / w) - Math.atan((-1 - 0.3) / w)) / Math.PI;
  assert.ok(Math.abs(integrate(f, -1, 1, 1e-10) - exact) < 1e-8);
});

test('simulated time follows the clock exactly whatever the frame rate', () => {
  for (const fps of [30, 60, 144]) {
    const run = createRun(release(2000, 25, 0), TOY, FLOOR, false);
    const frame = 0.02 / fps;
    for (let i = 0; i < fps; i++) run.advance(frame);
    assert.ok(Math.abs(run.state.t + run.pending - 0.02) < 1e-12, `${fps}`);
    assert.ok(run.pending < run.h);
  }
});

test('runs predicted to touch the table do, and others do not', () => {
  for (const [rpm, tilt, push] of [[900, 25, 0], [1000, 3, 0], [2000, 37, -1.5], [2000, 25, 0], [3000, 3, 0], [2000, 25, -0.8]]) {
    const rel = release(rpm, tilt, push);
    const touches = turningPoints(constants(rel)).thetaMax >= FLOOR;
    const run = createRun(rel, TOY, FLOOR, touches);
    run.advance(4, null, 1, 1e9);
    assert.equal(run.fell, touches, `${rpm} ${tilt} ${push}`);
  }
});

test('a nod whose outer end just reaches the rim still counts as touching', () => {
  // Spin chosen by bisection so the outer turning point sits at the floor.
  let lo = 1100;
  let hi = 1250;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (turningPoints(constants(release(mid, 25, 0))).thetaMax >= FLOOR) lo = mid;
    else hi = mid;
  }
  const rel = release(lo, 25, 0);
  const tp = turningPoints(constants(rel));
  assert.ok(tp.thetaMax >= FLOOR && tp.thetaMax - FLOOR < 1e-9);
  const run = createRun(rel, TOY, FLOOR, true);
  run.advance(3, null, 1, 1e9);
  assert.equal(run.fell, true);
});
