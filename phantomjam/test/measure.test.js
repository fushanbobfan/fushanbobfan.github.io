import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RollingMean,
  FundamentalDiagram,
  createSweep,
  sweepDensity,
  sweepTick,
  sweepProgress,
} from '../src/measure.js';

test('RollingMean averages the last N values only', () => {
  const m = new RollingMean(3);
  assert.equal(m.mean, 0);
  m.push(3);
  assert.equal(m.mean, 3);
  m.push(6);
  assert.equal(m.mean, 4.5);
  m.push(9);
  assert.equal(m.mean, 6);
  m.push(12); // 3 drops out
  assert.equal(m.mean, 9);
  m.reset();
  assert.equal(m.mean, 0);
  assert.equal(m.push(1), 1);
});

test('FundamentalDiagram bins densities and averages flow per bin', () => {
  const fd = new FundamentalDiagram(10);
  fd.add(0.21, 0.4);
  fd.add(0.29, 0.6);
  fd.add(0.75, 0.2);
  const pts = fd.points();
  assert.equal(pts.length, 2);
  assert.deepEqual(pts[0], { density: 0.25, flow: 0.5, n: 2 });
  assert.deepEqual(pts[1], { density: 0.75, flow: 0.2, n: 1 });
  assert.equal(fd.size, 2);
});

test('FundamentalDiagram clamps out-of-range densities into the edge bins and clears', () => {
  const fd = new FundamentalDiagram(4);
  fd.add(-0.5, 1);
  fd.add(1.0, 2);
  fd.add(2.0, 3);
  const pts = fd.points();
  assert.equal(pts[0].density, 0.125);
  assert.equal(pts[1].density, 0.875);
  assert.equal(pts[1].n, 2);
  fd.clear();
  assert.deepEqual(fd.points(), []);
  assert.equal(fd.size, 0);
});

test('a sweep walks its stops in order, settles before recording and finishes', () => {
  const sweep = createSweep({ from: 0.1, to: 0.5, stops: 5, settle: 2, sample: 3 });
  const visited = [];
  let recorded = 0;
  let guard = 0;
  visited.push(sweepDensity(sweep));
  for (;;) {
    const { recording, changed, done } = sweepTick(sweep);
    if (recording) recorded += 1;
    if (changed) visited.push(sweepDensity(sweep));
    if (done) break;
    assert.ok(guard++ < 1000);
  }
  assert.deepEqual(
    visited.map((d) => Number(d.toFixed(6))),
    [0.1, 0.2, 0.3, 0.4, 0.5],
  );
  assert.equal(recorded, 5 * 3);
  assert.equal(guard, 5 * (2 + 3) - 1);
  assert.equal(sweepProgress(sweep), 1);
  assert.deepEqual(sweepTick(sweep), { recording: false, changed: false, done: true });
});

test('the first ticks of every stop are not recorded', () => {
  const sweep = createSweep({ stops: 2, settle: 3, sample: 1 });
  const flags = [];
  for (let i = 0; i < 8; i++) flags.push(sweepTick(sweep).recording);
  assert.deepEqual(flags, [false, false, false, true, false, false, false, true]);
});

test('sweepProgress grows monotonically from 0', () => {
  const sweep = createSweep({ stops: 3, settle: 1, sample: 1 });
  assert.equal(sweepProgress(sweep), 0);
  let last = 0;
  while (!sweep.done) {
    sweepTick(sweep);
    const p = sweepProgress(sweep);
    assert.ok(p >= last && p <= 1);
    last = p;
  }
});

test('a single-stop sweep holds its starting density', () => {
  const sweep = createSweep({ from: 0.3, to: 0.9, stops: 1, settle: 0, sample: 2 });
  assert.equal(sweepDensity(sweep), 0.3);
  assert.equal(sweepTick(sweep).recording, true);
  assert.equal(sweepTick(sweep).done, true);
  assert.throws(() => createSweep({ stops: 0 }), RangeError);
});
