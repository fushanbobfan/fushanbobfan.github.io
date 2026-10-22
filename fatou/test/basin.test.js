import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestCyclePoint, phaseOf } from '../src/basin.js';
import { attractingCycle } from '../src/cycle.js';
import { sample, SAMPLE_SIZE, PERIOD, STEPS, LAST_X, LAST_Y } from '../src/dynamics.js';

const out = new Float64Array(SAMPLE_SIZE);

function phaseAt(cyc, c, x, y) {
  sample(out, x, y, c[0], c[1], 20000, true);
  assert.equal(out[PERIOD], cyc.period, `period at ${x}, ${y}`);
  return phaseOf(cyc.points, out[STEPS], out[LAST_X], out[LAST_Y]);
}

test('nearest cycle point', () => {
  const pts = [0, 0, -1, 0, 0.5, 0.5];
  assert.equal(nearestCyclePoint(pts, 0.1, 0), 0);
  assert.equal(nearestCyclePoint(pts, -0.8, 0.1), 1);
  assert.equal(nearestCyclePoint(pts, 0.6, 0.4), 2);
});

test('phase wraps negative offsets into 0..p-1', () => {
  const pts = [0, 0, 1, 0, 2, 0];
  assert.equal(phaseOf(pts, 0, 1, 0), 1);
  assert.equal(phaseOf(pts, 4, 0, 0), 2); // (0 - 4) mod 3
  assert.equal(phaseOf(pts, 3, 2, 0), 2);
});

test('the basilica: the components around 0 and -1 have different phases', () => {
  const c = [-1, 0];
  const cyc = attractingCycle(...c);
  const a = phaseAt(cyc, c, 0.05, 0.05);
  const b = phaseAt(cyc, c, -1.05, 0.03);
  assert.notEqual(a, b);
  // each component's phase is the index of the cycle point inside it
  assert.equal(a, nearestCyclePoint(cyc.points, 0, 0));
  assert.equal(b, nearestCyclePoint(cyc.points, -1, 0));
});

test('the rabbit: the three ears around the cycle points get all three phases', () => {
  const c = [-0.122561166876654, 0.744861766619744];
  const cyc = attractingCycle(...c);
  const phases = [];
  for (let k = 0; k < 3; k++) {
    const x = cyc.points[2 * k];
    const y = cyc.points[2 * k + 1];
    const ph = phaseAt(cyc, c, x + 0.01, y - 0.01);
    assert.equal(ph, k);
    phases.push(ph);
  }
  assert.deepEqual(phases.sort(), [0, 1, 2]);
});

test('the map moves a point one phase forward', () => {
  const c = [-0.122561166876654, 0.744861766619744];
  const cyc = attractingCycle(...c);
  const [x, y] = [0.03, -0.04];
  const before = phaseAt(cyc, c, x, y);
  const after = phaseAt(cyc, c, x * x - y * y + c[0], 2 * x * y + c[1]);
  assert.equal(after, (before + 1) % 3);
});
