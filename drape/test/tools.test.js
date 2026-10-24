import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloth, step } from '../src/cloth.js';
import { nearest, segmentsCross, cut, togglePin, hold, pinCount } from '../src/tools.js';

test('nearest finds the closest particle within the radius', () => {
  const c = createCloth({ cols: 4, rows: 3, spacing: 1 });
  assert.equal(nearest(c, 2.2, 0.9), 6);
  assert.equal(nearest(c, 2.2, 0.9, 0.1), -1);
  assert.equal(nearest(c, -5, -5), 0);
});

test('segments cross only through each other', () => {
  assert.equal(segmentsCross(0, 0, 2, 2, 0, 2, 2, 0), true);
  assert.equal(segmentsCross(0, 0, 1, 1, 2, 0, 3, 1), false);
  assert.equal(segmentsCross(0, 0, 2, 0, 1, 1, 1, 3), false);
});

test('a vertical stroke through a grid cuts exactly one horizontal link per row', () => {
  const c = createCloth({ cols: 5, rows: 4, spacing: 1 });
  const n = cut(c, 1.5, -1, 1.5, 10);
  assert.equal(n, 4);
  assert.equal(c.brokenCount, 4);
  assert.equal(cut(c, 1.5, -1, 1.5, 10), 0, 'already cut');
});

test('a cloth cut free of its pins falls away', () => {
  const c = createCloth({ cols: 6, rows: 4, spacing: 0.1, pins: (i, j) => j === 0 });
  cut(c, -1, 0.05, 2, 0.05);
  for (let s = 0; s < 120; s++) step(c, 1 / 120);
  for (let k = 6; k < c.n; k++) assert.ok(c.y[k] > 3, `particle ${k} at ${c.y[k]}`);
  for (let k = 0; k < 6; k++) assert.equal(c.y[k], 0);
});

test('toggling a pin freezes the particle where it is', () => {
  const c = createCloth({ cols: 2, rows: 2, spacing: 1 });
  c.py[3] = c.y[3] - 0.5;
  assert.equal(togglePin(c, 3), true);
  assert.equal(c.py[3], c.y[3]);
  assert.equal(pinCount(c), 1);
  assert.equal(togglePin(c, 3), false);
  assert.equal(pinCount(c), 0);
});

test('releasing a dragged particle keeps the drag velocity', () => {
  const c = createCloth({ cols: 1, rows: 1, spacing: 1 });
  hold(c, 0, 0.1, 0);
  step(c, 1 / 100, { gravity: 0, damping: 0 });
  assert.ok(Math.abs(c.x[0] - 0.2) < 1e-12, `${c.x[0]}`);
});
