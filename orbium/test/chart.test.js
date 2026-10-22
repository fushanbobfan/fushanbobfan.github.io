import test from 'node:test';
import assert from 'node:assert/strict';
import { scaler, kernelPoints, potentialAxis, growthPoints, histogram, shareInBand } from '../src/chart.js';

const box = { x: 10, y: 20, w: 100, h: 50 };

test('the scaler puts the low corner bottom-left and the high corner top-right', () => {
  const map = scaler(box, [0, 1], [-1, 1]);
  assert.deepEqual(map(0, -1), [10, 70]);
  assert.deepEqual(map(1, 1), [110, 20]);
  assert.deepEqual(map(0.5, 0), [60, 45]);
});

test('kernel points start and end on the floor and peak at mid radius for one ring', () => {
  const pts = kernelPoints([1], box, 101);
  assert.deepEqual(pts[0], [10, 70]);
  assert.deepEqual(pts[100], [110, 70]);
  assert.ok(Math.abs(pts[50][1] - 20) < 1e-9);
});

test('the potential axis reaches twice mu, or past the band for wide rules', () => {
  assert.deepEqual(potentialAxis(0.15, 0.015), [0, 0.3]);
  const [, hi] = potentialAxis(0.1, 0.06);
  assert.ok(hi > 0.2);
  assert.equal(potentialAxis(0.6, 0.1)[1], 1);
});

test('the growth curve tops out at mu', () => {
  const pts = growthPoints(0.15, 0.015, box, 201);
  const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
  assert.ok(Math.abs(top[0] - 60) < 0.6, `peak at x=${top[0]}`);
  assert.ok(Math.abs(top[1] - 20) < 1e-6);
  assert.ok(Math.abs(pts[0][1] - 70) < 1e-6, 'far below mu growth is -1');
});

test('the histogram skips near-zero values and counts the rest into bins', () => {
  const h = histogram(Float64Array.from([0, 0.0005, 0.05, 0.15, 0.16, 0.29, 0.3, 0.9]), 3, 0, 0.3);
  assert.deepEqual(Array.from(h.counts), [1, 2, 2]);
  assert.equal(h.total, 5);
  assert.equal(shareInBand(h, 0, 0.3, 0.15, 0.015), 2 / 5);
  assert.equal(shareInBand({ counts: new Uint32Array(3), total: 0 }, 0, 0.3, 0.15, 0.015), 0);
});
