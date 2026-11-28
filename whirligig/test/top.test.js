import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOY, makeTop, floorAngle, criticalSpin, steadyPrecession, constants, initialState, step,
  energy, turningPoints, classify, nodding, rpmToRad, radToRpm, fOfU, effectivePotential, energyJoules,
} from '../src/top.js';

const deg = Math.PI / 180;

function release(rpm, tiltDeg, push) {
  const omega3 = rpmToRad(rpm);
  const theta = tiltDeg * deg;
  const sp = steadyPrecession(theta, omega3);
  const ref = sp ? sp.slow : TOY.mgl / (TOY.I3 * omega3);
  return { theta, phiDot: push * ref, omega3 };
}

function run(rel, seconds, h = 5e-5, onStep) {
  const c = constants(rel);
  let s = initialState(rel);
  const n = Math.round(seconds / h);
  for (let i = 0; i < n; i++) {
    s = step(s, c, h);
    if (onStep) onStep(s);
  }
  return { c, s };
}

test('the toy top has the moments of a thin disc on a stalk', () => {
  const m = 0.1, r = 0.03, l = 0.04;
  assert.ok(Math.abs(TOY.I3 - 0.5 * m * r * r) < 1e-15);
  assert.ok(Math.abs(TOY.I1 - (0.25 * m * r * r + m * l * l)) < 1e-15);
  assert.ok(Math.abs(floorAngle() / deg - 53.130102) < 1e-5);
  // 2 sqrt(I1 m g l) / I3, worked out by hand: 118.94 rad/s.
  assert.ok(Math.abs(criticalSpin() - 118.937) < 0.01);
  assert.ok(Math.abs(radToRpm(rpmToRad(1234)) - 1234) < 1e-9);
  const tall = makeTop({ height: 0.06 });
  assert.ok(floorAngle(tall) > floorAngle());
});

test('energy stays constant along the integrated motion', () => {
  for (const rel of [release(2000, 25, 0), release(2000, 25, -0.8), release(1300, 40, 1.6), release(3500, 10, 0.3)]) {
    const c = constants(rel);
    const e0 = energy(initialState(rel), c);
    const { s } = run(rel, 3);
    assert.ok(Math.abs(energy(s, c) - e0) / e0 < 1e-10, JSON.stringify(rel));
  }
});

test('the Euler-angle equations agree with a rigid body integrated as vectors', () => {
  // dL/dt = l e3 x (-m g z), de3/dt = omega x e3, with
  // omega = L / I1 + (1/I3 - 1/I1)(L . e3) e3 for a symmetric body.
  const rel = release(1500, 30, -0.5);
  const { I1, I3, mgl } = TOY;
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const e3 = [Math.sin(rel.theta), 0, Math.cos(rel.theta)];
  const zPerp = [-Math.cos(rel.theta) * e3[0], 0, 1 - Math.cos(rel.theta) * e3[2]];
  let y = [...zPerp.map((v, i) => I1 * rel.phiDot * v + I3 * rel.omega3 * e3[i]), ...e3];
  const f = (y) => {
    const L = y.slice(0, 3);
    const e = y.slice(3);
    const l3 = dot(L, e);
    const w = L.map((v, i) => v / I1 + (1 / I3 - 1 / I1) * l3 * e[i]);
    const dL = cross(e, [0, 0, -mgl]);
    return [...dL, ...cross(w, e)];
  };
  const h = 2e-5;
  const c = constants(rel);
  let s = initialState(rel);
  let phiPrev = 0;
  let phiUnwrapped = 0;
  for (let i = 1; i <= 100000; i++) {
    const k1 = f(y);
    const k2 = f(y.map((v, j) => v + (h / 2) * k1[j]));
    const k3 = f(y.map((v, j) => v + (h / 2) * k2[j]));
    const k4 = f(y.map((v, j) => v + h * k3[j]));
    y = y.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    s = step(s, c, h);
    const phi = Math.atan2(y[4], y[3]);
    let d = phi - phiPrev;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    phiUnwrapped += d;
    phiPrev = phi;
    if (i % 5000 === 0) {
      assert.ok(Math.abs(Math.acos(y[5]) - s.theta) < 1e-7, `theta at ${s.t}`);
      assert.ok(Math.abs(phiUnwrapped - s.phi) < 1e-6, `phi at ${s.t}`);
    }
  }
});

test('the turning points are the extremes the simulation reaches', () => {
  for (const [rel, kind] of [
    [release(2000, 25, 0), 'cusps'],
    [release(2000, 25, -0.8), 'loops'],
    [release(2000, 25, 1.8), 'waves'],
    [release(2000, 25, 0.5), 'waves'],
    [release(1300, 40, 0.2), 'waves'],
  ]) {
    const c = constants(rel);
    const tp = turningPoints(c);
    assert.equal(classify(c, tp), kind);
    let lo = Infinity;
    let hi = -Infinity;
    run(rel, 2, 5e-5, (s) => {
      lo = Math.min(lo, s.theta);
      hi = Math.max(hi, s.theta);
    });
    assert.ok(Math.abs(lo - tp.thetaMin) < 2e-6, `${kind} min`);
    assert.ok(Math.abs(hi - tp.thetaMax) < 2e-6, `${kind} max`);
    assert.ok(fOfU(Math.cos(0.5 * (lo + hi)), c) > 0);
    assert.ok(fOfU(Math.cos(tp.thetaMax + 0.01), c) < 0);
  }
});

test('the band is where the effective potential is below the energy', () => {
  const c = constants(release(2000, 25, -0.8));
  const tp = turningPoints(c);
  const E = energyJoules(c);
  assert.ok(Math.abs(effectivePotential(tp.thetaMin, c) - E) / E < 1e-9);
  assert.ok(Math.abs(effectivePotential(tp.thetaMax, c) - E) / E < 1e-9);
  assert.ok(effectivePotential(0.5 * (tp.thetaMin + tp.thetaMax), c) < E);
  assert.ok(effectivePotential(tp.thetaMin - 0.02, c) > E);
  assert.ok(effectivePotential(tp.thetaMax + 0.02, c) > E);
});

test('released at either steady rate the tilt does not change', () => {
  const omega3 = rpmToRad(2000);
  const theta = 25 * deg;
  const sp = steadyPrecession(theta, omega3);
  for (const phiDot of [sp.slow, sp.fast]) {
    const rel = { theta, phiDot, omega3 };
    const c = constants(rel);
    assert.equal(classify(c), 'steady');
    let worst = 0;
    run(rel, 0.5, 1e-5, (s) => {
      worst = Math.max(worst, Math.abs(s.theta - theta));
    });
    assert.ok(worst < 1e-6, `${phiDot}: ${worst}`);
  }
  // I1 cos(theta) W^2 - I3 omega3 W + m g l = 0 at both roots.
  for (const W of [sp.slow, sp.fast]) {
    const r = TOY.I1 * Math.cos(theta) * W * W - TOY.I3 * omega3 * W + TOY.mgl;
    assert.ok(Math.abs(r) < 1e-12);
  }
  assert.equal(steadyPrecession(25 * deg, rpmToRad(600)), null);
  assert.ok(steadyPrecession(25 * deg, rpmToRad(1100)) !== null);
});

test('the nod period and mean precession match the simulation over many nods', () => {
  for (const rel of [release(2000, 25, 0), release(1300, 25, -0.6), release(2500, 35, 1.7)]) {
    const c = constants(rel);
    const nod = nodding(c);
    // Count passes through the top of the band (largest cos theta).
    const peaks = [];
    let prev = null;
    run(rel, 4, 2e-5, (s) => {
      if (prev && prev.thetaDot < 0 && s.thetaDot >= 0) {
        const f = prev.thetaDot / (prev.thetaDot - s.thetaDot);
        peaks.push({ t: prev.t + f * (s.t - prev.t), phi: prev.phi + f * (s.phi - prev.phi) });
      }
      prev = s;
    });
    assert.ok(peaks.length > 10);
    const first = peaks[0];
    const last = peaks[peaks.length - 1];
    const k = peaks.length - 1;
    assert.ok(Math.abs((last.t - first.t) / k - nod.period) / nod.period < 1e-5, 'period');
    assert.ok(Math.abs((last.phi - first.phi) / k - nod.turn) / Math.abs(nod.turn) < 1e-5, 'turn');
  }
});

test('a fast top follows the textbook estimates', () => {
  const rpm = 6000;
  const omega3 = rpmToRad(rpm);
  const theta = 30 * deg;
  const c = constants({ theta, phiDot: 0, omega3 });
  const tp = turningPoints(c);
  const nod = nodding(c, tp);
  const L3 = TOY.I3 * omega3;
  const slow = TOY.mgl / L3;
  const nodRate = L3 / TOY.I1;
  const dip = (2 * TOY.I1 * TOY.mgl * Math.sin(theta)) / (L3 * L3);
  assert.ok(Math.abs(nod.precessionRate - slow) / slow < 0.03);
  assert.ok(Math.abs(nod.period - (2 * Math.PI) / nodRate) / nod.period < 0.03);
  assert.ok(Math.abs(tp.thetaMax - tp.thetaMin - dip) / dip < 0.1);
});

test('only a top spun past the critical rate stands nearly upright', () => {
  const crit = radToRpm(criticalSpin());
  const fast = turningPoints(constants(release(crit * 1.3, 3, 0)));
  const slow = turningPoints(constants(release(crit * 0.8, 3, 0)));
  assert.ok(fast.thetaMax < 6 * deg);
  assert.ok(slow.thetaMax > floorAngle());
});
