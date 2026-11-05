import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSICAL, angleGap, curvature, torque } from '../src/machine.js';
import { restPoints, settle } from '../src/equilibria.js';
import { traceFoldSet } from '../src/foldset.js';
import { controlOnLine, foldsOnLine, offsetOfLine, positionOnLine, sliceCurve, sweepAlong } from '../src/slice.js';
import { sweepPath } from '../src/wheel.js';

const m = CLASSICAL;
const chains = traceFoldSet(m);

function anglesAt(segments, s) {
  const stable = [];
  const unstable = [];
  for (const seg of segments) {
    if ((seg.sa > s) !== (seg.sb > s)) {
      const theta = seg.ta + ((s - seg.sa) * (seg.tb - seg.ta)) / (seg.sb - seg.sa);
      (seg.stable ? stable : unstable).push(theta);
    }
  }
  return { stable, unstable };
}

test('lines address control points both ways', () => {
  const v = { axis: 'y', at: -2 };
  const h = { axis: 'x', at: 0.3 };
  assert.deepEqual(controlOnLine(v, 0.5), { x: -2, y: 0.5 });
  assert.deepEqual(controlOnLine(h, -1), { x: -1, y: 0.3 });
  assert.equal(positionOnLine(v, { x: -2, y: 0.5 }), 0.5);
  assert.equal(offsetOfLine(h, { x: -1, y: 0.3 }), 0.3);
});

test('the slice agrees with a direct search for equilibria', () => {
  for (const line of [{ axis: 'y', at: -2 }, { axis: 'x', at: 0.3 }, { axis: 'y', at: -1 }]) {
    const range = line.axis === 'y' ? [-1.5, 1.5] : [-3.5, -0.5];
    const segments = sliceCurve(m, line, range);
    for (let s = range[0] + 0.113; s < range[1]; s += 0.27) {
      const c = controlOnLine(line, s);
      const direct = restPoints(m, c.x, c.y, 720);
      const found = anglesAt(segments, s);
      assert.equal(found.stable.length, direct.minima.length, `stable at ${s} on ${line.axis}`);
      assert.equal(found.unstable.length, direct.maxima.length, `unstable at ${s} on ${line.axis}`);
      for (const p of direct.minima) {
        assert.ok(found.stable.some((t) => Math.abs(angleGap(t, p.theta)) < 0.02), `well ${p.theta}`);
      }
    }
  }
});

test('segments sit on zero torque, and their marks match the curvature', () => {
  const line = { axis: 'y', at: -2 };
  for (const seg of sliceCurve(m, line, [-1.2, 1.2])) {
    const c = controlOnLine(line, seg.sa);
    assert.ok(Math.abs(torque(m, c.x, c.y, seg.ta)) < 2e-3);
    const mid = controlOnLine(line, 0.5 * (seg.sa + seg.sb));
    assert.equal(seg.stable, curvature(m, mid.x, mid.y, 0.5 * (seg.ta + seg.tb)) > 0);
  }
});

test('the S folds exactly at the crossings of the set', () => {
  const line = { axis: 'y', at: -2 };
  const folds = foldsOnLine(chains, line);
  assert.equal(folds.length, 2);
  const stableCount = (s) => {
    const c = controlOnLine(line, s);
    return restPoints(m, c.x, c.y, 720).minima.length;
  };
  assert.equal(stableCount(folds[0] - 0.01), 1);
  assert.equal(stableCount(folds[0] + 0.01), 2);
  assert.equal(stableCount(folds[1] - 0.01), 2);
  assert.equal(stableCount(folds[1] + 0.01), 1);
});

test('outside the diamond the slice has no folds', () => {
  assert.deepEqual(foldsOnLine(chains, { axis: 'y', at: -1 }), []);
  assert.deepEqual(foldsOnLine(chains, { axis: 'x', at: 1.2 }), []);
});

test('a sweep across the diamond makes one full loop with a snap at each fold', () => {
  const line = { axis: 'y', at: -2 };
  const folds = foldsOnLine(chains, line);
  const from = { x: -2, y: 1 };
  const path = sweepAlong(line, from, folds, [-1.4, 1.4]);
  const run = sweepPath(m, path, settle(m, from.x, from.y, 1.5));
  assert.equal(run.snaps.length, 2);
  const at = run.snaps.map((s) => s.y).sort((a, b) => a - b);
  assert.ok(Math.abs(at[0] - folds[0]) < 0.01);
  assert.ok(Math.abs(at[1] - folds[1]) < 0.01);
});

test('a sweep stays inside the range it is given', () => {
  const line = { axis: 'y', at: -2 };
  const path = sweepAlong(line, { x: -2, y: 0 }, [-3, 3], [-1, 1]);
  for (const p of path) assert.ok(Math.abs(p.y) <= 1);
  const empty = sweepAlong({ axis: 'y', at: -1 }, { x: -1, y: 0.2 }, [], [-1, 1]);
  assert.equal(empty[1].y, 1);
  assert.equal(empty[2].y, -1);
});
