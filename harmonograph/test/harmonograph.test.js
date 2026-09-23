import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDesign,
  normalizePendulum,
  displacement,
  penPosition,
  envelope,
  settleTime,
  sampleCurve,
  bounds,
  fitTransform,
} from '../src/harmonograph.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('normalizePendulum fills defaults and clamps out-of-range values', () => {
  const p = normalizePendulum({ axis: 'z', amp: 5, freq: -1, damp: 'x', phase: 7 });
  assert.equal(p.axis, 'x');
  assert.equal(p.amp, 1);
  assert.equal(p.freq, 0.1);
  assert.equal(p.damp, 0);
  close(p.phase, 7 - 2 * Math.PI);
});

test('normalizePendulum keeps +π at the top of the range', () => {
  close(normalizePendulum({ phase: Math.PI }).phase, Math.PI);
  close(normalizePendulum({ phase: -Math.PI }).phase, -Math.PI);
});

test('normalizeDesign caps the number of pendulums', () => {
  const design = normalizeDesign({ pendulums: Array.from({ length: 10 }, () => ({})) });
  assert.equal(design.pendulums.length, 6);
  assert.deepEqual(normalizeDesign({}).pendulums, []);
});

test('displacement decays exponentially at the peaks', () => {
  const p = normalizePendulum({ amp: 1, freq: 1, phase: Math.PI / 2, damp: 0.1 });
  close(displacement(p, 0), 1);
  close(displacement(p, 10), Math.exp(-1));
});

test('two undamped axis pendulums at 1:1 with a quarter-turn phase trace a circle', () => {
  const design = normalizeDesign({
    pendulums: [
      { axis: 'x', amp: 0.5, freq: 1, phase: Math.PI / 2, damp: 0 },
      { axis: 'y', amp: 0.5, freq: 1, phase: 0, damp: 0 },
    ],
  });
  for (const t of [0, 0.13, 0.4, 0.77]) {
    const { x, y } = penPosition(design, t);
    close(Math.hypot(x, y), 0.5);
  }
});

test('a rotary pendulum alone traces a shrinking circle', () => {
  const design = normalizeDesign({ pendulums: [{ axis: 'rotary', amp: 0.8, freq: 2, damp: 0.05 }] });
  for (const t of [0, 1, 5, 20]) {
    const { x, y } = penPosition(design, t);
    close(Math.hypot(x, y), 0.8 * Math.exp(-0.05 * t));
  }
});

test('envelope bounds the pen distance and decreases over time', () => {
  const design = normalizeDesign({
    pendulums: [
      { axis: 'x', amp: 0.4, freq: 2, damp: 0.02 },
      { axis: 'x', amp: 0.3, freq: 3.01, damp: 0.01 },
      { axis: 'y', amp: 0.5, freq: 2.99, phase: 1, damp: 0.015 },
      { axis: 'rotary', amp: 0.2, freq: 0.5, damp: 0.03 },
    ],
  });
  let previous = Infinity;
  for (let t = 0; t < 60; t += 0.37) {
    const { x, y } = penPosition(design, t);
    const env = envelope(design, t);
    assert.ok(Math.hypot(x, y) <= env + 1e-12);
    assert.ok(env <= previous);
    previous = env;
  }
});

test('settleTime finds when the reach falls to the requested fraction', () => {
  const design = normalizeDesign({ pendulums: [{ axis: 'x', amp: 1, damp: 0.1 }] });
  close(settleTime(design, 0.05), Math.log(20) / 0.1, 1e-6);
  const undamped = normalizeDesign({ pendulums: [{ axis: 'x', amp: 1, damp: 0 }] });
  assert.equal(settleTime(undamped, 0.05, 300), 300);
  assert.equal(settleTime(normalizeDesign({}), 0.05), 0);
});

test('sampleCurve returns evenly timed interleaved points', () => {
  const design = normalizeDesign({ pendulums: [{ axis: 'x', amp: 1, freq: 1, damp: 0 }] });
  const pts = sampleCurve(design, { duration: 1, samplesPerSecond: 4 });
  assert.equal(pts.length, 10);
  close(pts[0], 0);
  close(pts[2], 1); // t = 0.25, sin(π/2)
  close(pts[4], 0, 1e-12);
  close(pts[6], -1);
  pts.filter((_, i) => i % 2 === 1).forEach((y) => assert.equal(y, 0));
});

test('bounds handles empty and populated point lists', () => {
  assert.deepEqual(bounds(new Float64Array()), { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  assert.deepEqual(bounds(Float64Array.of(1, -2, -3, 4, 0, 0)), { minX: -3, minY: -2, maxX: 1, maxY: 4 });
});

test('fitTransform centres the box and flips y', () => {
  const fit = fitTransform({ minX: -1, minY: -1, maxX: 1, maxY: 1 }, 200, 100, 10);
  assert.equal(fit.scale, 40);
  assert.deepEqual(fit.toScreen(0, 0), [100, 50]);
  assert.deepEqual(fit.toScreen(1, 1), [140, 10]);
});
