import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartRange, chartSvg, decades, logSamples, recordPoint, toChart } from '../src/convergence.js';

const expected = (n) => 0.8 / Math.sqrt(n);

test('points are recorded only after the count grows by the factor', () => {
  const h = [];
  assert.equal(recordPoint(h, 0, 0.5), false);
  assert.equal(recordPoint(h, 10, 0.3), true);
  assert.equal(recordPoint(h, 11, 0.3), false);
  assert.equal(recordPoint(h, 12, 0.29), true);
  assert.equal(recordPoint(h, 5000, NaN), false);
  assert.deepEqual(h.map((p) => p.total), [10, 12]);
});

test('a long run stays a short history', () => {
  const h = [];
  for (let n = 1; n <= 100000; n++) recordPoint(h, n, expected(n));
  assert.ok(h.length < 120, `${h.length} points`);
});

test('the range spans whole decades and grows with the run', () => {
  assert.deepEqual(chartRange([], expected), { xmin: 1, xmax: 10000, ymin: 0.001, ymax: 1 });
  const r = chartRange([{ total: 23000, distance: 0.004 }], expected);
  assert.equal(r.xmax, 100000);
  assert.equal(r.ymin, 0.001);
  assert.equal(chartRange([{ total: 10, distance: 0.0004 }], expected).ymin, 0.0001);
});

test('the log-log mapping puts decades evenly across the box', () => {
  const at = toChart({ xmin: 1, xmax: 10000, ymin: 0.001, ymax: 1 }, { left: 0, right: 400, top: 0, bottom: 300 });
  assert.deepEqual(at(1, 1), [0, 0]);
  assert.deepEqual(at(10000, 0.001), [400, 300]);
  const [x, y] = at(100, 0.1);
  assert.ok(Math.abs(x - 200) < 1e-9 && Math.abs(y - 100) < 1e-9);
  assert.deepEqual(at(10000, 1e-9), [400, 300]);
});

test('one over root N is a straight line of slope -1/2 on the chart', () => {
  const at = toChart({ xmin: 1, xmax: 10000, ymin: 0.001, ymax: 1 }, { left: 0, right: 400, top: 0, bottom: 300 });
  const pts = logSamples(1, 10000, 5).map((n) => at(n, expected(n)));
  const slopes = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (p[0] - pts[i][0]));
  for (const s of slopes) assert.ok(Math.abs(s - slopes[0]) < 1e-9);
  assert.ok(Math.abs(slopes[0] - 0.5 * (300 / 3) / (400 / 4)) < 1e-9);
});

test('decades and log samples cover their ends', () => {
  assert.deepEqual(decades(1, 1000), [1, 10, 100, 1000]);
  const s = logSamples(1, 100, 3);
  assert.ok(Math.abs(s[1] - 10) < 1e-9 && s[2] === 100);
});

test('the chart has the expected curve always and the observed line once there is data', () => {
  const empty = chartSvg([], expected);
  assert.match(empty, /class="expected"/);
  assert.doesNotMatch(empty, /class="observed"/);
  const full = chartSvg([{ total: 10, distance: 0.2 }, { total: 100, distance: 0.08 }], expected);
  assert.match(full, /class="observed" d="M[\d.]+,[\d.]+L[\d.]+,[\d.]+"/);
  assert.match(full, /<text[^>]*text-anchor="end">10k<\/text>/);
  assert.doesNotMatch(full, /NaN/);
});
