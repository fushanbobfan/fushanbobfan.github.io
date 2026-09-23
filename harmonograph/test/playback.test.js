import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPEEDS, MAX_DURATION, planDrawing, pointIndexAt, formatSpeed } from '../src/playback.js';
import { normalizeDesign } from '../src/harmonograph.js';

test('planDrawing stops once the swing has mostly died away', () => {
  const design = normalizeDesign({ pendulums: [{ axis: 'x', amp: 1, freq: 2, damp: 0.1 }] });
  const { duration } = planDrawing(design);
  assert.ok(Math.abs(duration - Math.log(1 / 0.03) / 0.1) < 1e-6);
});

test('planDrawing caps undamped designs and never returns zero length', () => {
  const undamped = normalizeDesign({ pendulums: [{ axis: 'x', amp: 1, damp: 0 }] });
  assert.equal(planDrawing(undamped).duration, MAX_DURATION);
  assert.equal(planDrawing(normalizeDesign({})).duration, 1);
});

test('sample rate follows the fastest pendulum within bounds', () => {
  const slow = normalizeDesign({ pendulums: [{ freq: 0.5 }] });
  const mid = normalizeDesign({ pendulums: [{ freq: 1 }, { freq: 5 }] });
  const fast = normalizeDesign({ pendulums: [{ freq: 12 }] });
  assert.equal(planDrawing(slow).samplesPerSecond, 120);
  assert.equal(planDrawing(mid).samplesPerSecond, 300);
  assert.equal(planDrawing(fast).samplesPerSecond, 720);
});

test('pointIndexAt advances with time and clamps to the drawing', () => {
  assert.equal(pointIndexAt(0, 100, 50), 0);
  assert.equal(pointIndexAt(0.105, 100, 50), 10);
  assert.equal(pointIndexAt(10, 100, 50), 49);
  assert.equal(pointIndexAt(-3, 100, 50), 0);
  assert.equal(pointIndexAt(1, 100, 0), -1);
});

test('speeds double from real time and format as multipliers', () => {
  SPEEDS.forEach((s, i) => assert.equal(s, 2 ** i));
  assert.equal(formatSpeed(8), '8×');
});
