import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloth, step } from '../src/cloth.js';
import { nearest, segmentsCross, cut, togglePin, grab, drag, release, pinCount } from '../src/tools.js';

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

test('a held particle follows the hand and anchors the cloth', () => {
  const c = createCloth({ cols: 1, rows: 3, spacing: 0.1 });
  const g = grab(c, 0.01, 0.01, 0.05);
  assert.equal(g.members.length, 1);
  for (let s = 0; s < 1200; s++) {
    drag(c, g, 0.5, 0.2);
    step(c, 1 / 120);
  }
  assert.equal(c.x[0], 0.5);
  assert.equal(c.y[0], 0.2);
  assert.ok(Math.abs(c.x[2] - 0.5) < 1e-3 && c.y[2] > 0.39, 'the rest hangs below the hand');
});

test('letting go of a free particle throws it with the hand velocity', () => {
  const c = createCloth({ cols: 1, rows: 1, spacing: 1 });
  const g = grab(c, 0, 0, 0.1);
  drag(c, g, 1, 0);
  release(c, g, 3, 0, 1 / 100);
  assert.equal(c.pinned[0], 0);
  step(c, 1 / 100, { gravity: 0, damping: 0 });
  assert.ok(Math.abs(c.x[0] - 1.03) < 1e-12, `${c.x[0]}`);
});

test('dragging a pin moves it and it stays pinned where it is dropped', () => {
  const c = createCloth({ cols: 2, rows: 1, spacing: 1, pins: (i) => i === 0 });
  const g = grab(c, 0, 0, 0.5);
  drag(c, g, -2, 1);
  release(c, g, 5, 5, 1 / 100);
  assert.equal(c.pinned[0], 1);
  step(c, 1 / 100);
  assert.equal(c.x[0], -2);
  assert.equal(c.y[0], 1);
});

test('a hand closes on a patch and carries it rigidly', () => {
  const c = createCloth({ cols: 5, rows: 5, spacing: 0.1 });
  const g = grab(c, 0.21, 0.19, 0.11);
  assert.equal(g.k, 12);
  assert.deepEqual(g.members.map((m) => m.k).sort((p, q) => p - q), [7, 11, 12, 13, 17]);
  drag(c, g, 1, 1);
  assert.equal(c.x[12], 1);
  assert.ok(Math.abs(c.x[13] - 1.1) < 1e-12 && Math.abs(c.y[7] - 0.9) < 1e-12);
  release(c, g);
  assert.equal(c.pinned.reduce((s, p) => s + p, 0), 0);
});

test('a hand that misses grabs nothing', () => {
  const c = createCloth({ cols: 2, rows: 2, spacing: 0.1 });
  assert.equal(grab(c, 3, 3, 0.1), null);
});
