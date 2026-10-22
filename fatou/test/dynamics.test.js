import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sample, orbit, inMainCardioid, inPeriod2Bulb,
  ESCAPED, SMOOTH, DISTANCE, PERIOD, STEPS, LAST_X, LAST_Y, SAMPLE_SIZE,
} from '../src/dynamics.js';

const out = new Float64Array(SAMPLE_SIZE);
const mand = (x, y, it = 5000) => Array.from(sample(out, 0, 0, x, y, it, false));

test('main cardioid and period-2 disk tests agree with known points', () => {
  assert.ok(inMainCardioid(0, 0));
  assert.ok(inMainCardioid(-0.5, 0));
  assert.ok(inMainCardioid(0.249, 0));
  assert.ok(!inMainCardioid(0.26, 0));
  assert.ok(!inMainCardioid(-0.76, 0));
  assert.ok(inPeriod2Bulb(-1, 0));
  assert.ok(inPeriod2Bulb(-1.2, 0.1));
  assert.ok(!inPeriod2Bulb(-1.3, 0));
});

test('the cardioid boundary is where the fixed point has multiplier of modulus one', () => {
  for (let k = 1; k < 12; k++) {
    const t = (2 * Math.PI * k) / 12;
    // c = e^{it}/2 - e^{2it}/4 is the boundary point with internal angle t
    const x = Math.cos(t) / 2 - Math.cos(2 * t) / 4;
    const y = Math.sin(t) / 2 - Math.sin(2 * t) / 4;
    assert.ok(inMainCardioid(x * 0.99, y * 0.99), `inside near angle ${k}/12`);
    assert.ok(!inMainCardioid(x * 1.02 + 0.001, y * 1.02), `outside near angle ${k}/12`);
  }
});

test('points far outside escape at once and points of the set do not', () => {
  assert.equal(mand(3, 0)[ESCAPED], 1);
  assert.equal(mand(0.3, 0)[ESCAPED], 1);
  assert.equal(mand(-2, 0)[ESCAPED], 0);
  assert.equal(mand(0, 1)[ESCAPED], 0); // c = i, preperiodic, on the boundary
  assert.equal(mand(-0.75, 0.1, 200)[ESCAPED], 1); // seahorse valley gap
});

test('periodicity checking reports the period of the attracting cycle', () => {
  assert.equal(mand(0, 0)[PERIOD], 1);
  assert.equal(mand(-0.5, 0.2)[PERIOD], 1);
  assert.equal(mand(-1, 0)[PERIOD], 2);
  assert.equal(mand(-1.3, 0)[PERIOD], 4);
  assert.equal(mand(-0.122561, 0.744862)[PERIOD], 3); // Douady's rabbit
  assert.equal(mand(-1.754878, 0)[PERIOD], 3); // the airplane
  assert.equal(mand(0.282, 0.53)[PERIOD], 4); // 1/4 bulb
  assert.equal(mand(0.3795, 0.3349)[PERIOD], 5); // 1/5 bulb
});

test('the smooth count is continuous across iteration bands', () => {
  // walk along the real axis to the right of the cusp, where the integer
  // escape count drops by one many times
  let prev = mand(0.26, 0)[SMOOTH];
  for (let x = 0.2601; x < 0.6; x += 0.0001) {
    const s = mand(x, 0)[SMOOTH];
    assert.ok(Math.abs(s - prev) < 0.5, `jump of ${s - prev} at ${x}`);
    prev = s;
  }
});

test('the distance estimate is within the Koebe factor of the true distance', () => {
  // M meets the real axis in [-2, 1/4] and lies inside |c| <= 2,
  // so these distances are known exactly
  const cases = [[-3, 0, 1], [-2.5, 0, 0.5]];
  for (const [x, y, approx] of cases) {
    const d = mand(x, y)[DISTANCE];
    assert.ok(d <= approx * 1.0001 && d >= approx / 4, `estimate ${d} for true ${approx}`);
  }
  const d1 = mand(1, 0)[DISTANCE];
  assert.ok(d1 <= 0.75 && d1 >= 0.75 / 4, `estimate ${d1} at c = 1`);
});

test('Julia sampling uses z0 as the variable', () => {
  const s = (zx, zy, cx, cy) => Array.from(sample(out, zx, zy, cx, cy, 3000, true));
  // for c = 0 the Julia set is the unit circle
  assert.equal(s(0.99, 0, 0, 0)[ESCAPED], 0);
  assert.equal(s(1.01, 0, 0, 0)[ESCAPED], 1);
  const d = s(1.5, 0, 0, 0)[DISTANCE];
  assert.ok(d <= 0.5 && d >= 0.5 / 4, `distance ${d} from 1.5 to the unit circle`);
  // for c = -1 the basin around 0 settles on the 2-cycle {0, -1}
  assert.equal(s(0.1, 0.1, -1, 0)[PERIOD], 2);
});

test('a settled orbit records where and when it met its cycle', () => {
  // z0 = -1 under c = -1: -1, 0, -1 returns to the saved start after 2 steps
  const s = Array.from(sample(out, -1, 0, -1, 0, 100, true));
  assert.equal(s[PERIOD], 2);
  assert.equal(s[STEPS], 2);
  assert.deepEqual([s[LAST_X], s[LAST_Y]], [-1, 0]);
});

test('orbit stops after leaving the radius and keeps the escaping point', () => {
  const o = orbit(0, 0, 1, 0, 100);
  // 0, 1, 2, 5: 5 is outside radius 2
  assert.deepEqual(Array.from(o), [0, 0, 1, 0, 2, 0, 5, 0]);
  const p = orbit(0, 0, -1, 0, 6);
  assert.deepEqual(Array.from(p), [0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0]);
});
