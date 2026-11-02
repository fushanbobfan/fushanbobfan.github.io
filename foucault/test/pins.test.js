import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, localSpin, precessionPeriod, solve, release, swingPeriod } from '../src/pendulum.js';
import { pinRing, segmentDistance, knock, fallTime, pinOffset } from '../src/pins.js';

test('the ring is evenly spaced and leaves the starting plane clear', () => {
  const pins = pinRing(24, 0.95);
  assert.equal(pins.length, 24);
  for (const p of pins) {
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 0.95) < 1e-12);
    // nearest pin to the north–south line is half a step away
    assert.ok(Math.abs(segmentDistance(p.x, p.y, 0, -1, 0, 1)) > 0.95 * Math.sin(Math.PI / 24) - 1e-12);
  }
});

test('segment distance measures to the nearest point, ends included', () => {
  assert.equal(segmentDistance(0, 1, -1, 0, 1, 0), 1);
  assert.equal(segmentDistance(3, 0, -1, 0, 1, 0), 2);
  assert.equal(segmentDistance(0.5, 0.5, 0, 0, 0, 0), Math.SQRT1_2);
});

test('a swing knocks over only the pins it passes', () => {
  const pins = pinRing(4, 1, 0); // at 45°, 135°, 225°, 315°
  const fell = knock(pins, -1, -1, 1, 1, 0.05, 7);
  assert.deepEqual(fell.map((p) => Math.round((p.angle * 180) / Math.PI)), [45, 225]);
  assert.ok(fell.every((p) => p.at === 7));
  assert.equal(knock(pins, -1, -1, 1, 1, 0.05, 8).length, 0, 'fallen pins stay down');
});

test('pins fall in turn, on the schedule of the turning plane', () => {
  // the Panthéon pendulum with the Earth spun up 50 times
  const length = 67, factor = 50, lat = 48.8462;
  const omegaZ = localSpin(lat, factor);
  const motion = solve({ length, omegaZ, ...release('rest', 1, length, G, omegaZ) });
  const radius = 0.96, reach = 0.04;
  const pins = pinRing(36, radius);
  const T = swingPeriod(length), dt = T / 200;
  const end = 0.5 * precessionPeriod(lat, factor);
  let prev = motion(0);
  for (let t = dt; t <= end; t += dt) {
    const m = motion(t);
    knock(pins, prev.x, prev.y, m.x, m.y, reach, t);
    prev = m;
  }
  assert.ok(pins.every((p) => p.down), 'half a turn sweeps the whole ring');
  for (const p of pins) {
    const want = fallTime(pinOffset(p, Math.PI / 2, omegaZ), radius, reach, omegaZ);
    assert.ok(Math.abs(p.at - want) < T, `pin at ${p.angle.toFixed(3)} fell at ${p.at.toFixed(0)} s, expected ${want.toFixed(0)} s`);
  }
  // opposite pins fall together, and in the north the order is clockwise
  const byAngle = [...pins].sort((a, b) => b.angle - a.angle);
  for (let k = 0; k < 17; k++) assert.ok(byAngle[k].at < byAngle[k + 1].at);
  for (let k = 0; k < 18; k++) assert.ok(Math.abs(byAngle[k].at - byAngle[k + 18].at) < T);
});
