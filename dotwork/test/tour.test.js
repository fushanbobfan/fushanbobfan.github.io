import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tourLength, nearestNeighbourTour, neighbourLists, twoOpt } from '../src/tour.js';
import { createRng } from '../src/rng.js';

function scatter(seed, count, size = 100) {
  const rng = createRng(seed);
  const p = new Float64Array(2 * count);
  for (let i = 0; i < 2 * count; i++) p[i] = rng.next() * size;
  return p;
}

function isPermutation(tour, count) {
  return [...tour].sort((a, b) => a - b).every((v, i) => v === i) && tour.length === count;
}

function segmentsCross(p, a, b, c, d) {
  const o = (u, v, w) =>
    Math.sign((p[2 * v] - p[2 * u]) * (p[2 * w + 1] - p[2 * u + 1]) - (p[2 * v + 1] - p[2 * u + 1]) * (p[2 * w] - p[2 * u]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

test('the length of a unit square tour is four', () => {
  const p = new Float64Array([0, 0, 1, 0, 1, 1, 0, 1]);
  assert.equal(tourLength(p, new Int32Array([0, 1, 2, 3])), 4);
});

test('the greedy tour visits every dot once, starting from the first', () => {
  for (const count of [1, 2, 3, 50, 777]) {
    const p = scatter(count, count);
    const t = nearestNeighbourTour(p, count);
    assert.ok(isPermutation(t, count));
    assert.equal(t[0], 0);
  }
});

test('each greedy step goes to the closest unvisited dot', () => {
  const p = scatter(21, 200);
  const t = nearestNeighbourTour(p, 200);
  const seen = new Set([t[0]]);
  for (let n = 1; n < 200; n++) {
    const cur = t[n - 1];
    let best = Infinity;
    for (let i = 0; i < 200; i++) {
      if (seen.has(i)) continue;
      best = Math.min(best, Math.hypot(p[2 * i] - p[2 * cur], p[2 * i + 1] - p[2 * cur + 1]));
    }
    const got = Math.hypot(p[2 * t[n]] - p[2 * cur], p[2 * t[n] + 1] - p[2 * cur + 1]);
    assert.equal(got, best);
    seen.add(t[n]);
  }
});

test('neighbour lists match a brute-force sort', () => {
  const p = scatter(5, 150);
  const { k, list } = neighbourLists(p, 150, 6);
  assert.equal(k, 6);
  for (let a = 0; a < 150; a++) {
    const d = (i) => Math.hypot(p[2 * i] - p[2 * a], p[2 * i + 1] - p[2 * a + 1]);
    const want = [...Array(150).keys()].filter((i) => i !== a).map(d).sort((x, y) => x - y).slice(0, 6);
    const got = [...list.subarray(a * 6, a * 6 + 6)].map(d);
    assert.deepEqual(got, want);
  }
});

test('neighbour lists shrink to the dots there are', () => {
  assert.equal(neighbourLists(scatter(1, 3), 3, 8).k, 2);
  assert.equal(neighbourLists(scatter(1, 1), 1, 8).k, 0);
});

test('2-opt shortens the greedy tour and leaves no crossing edges', () => {
  const count = 120;
  const p = scatter(17, count);
  const t = nearestNeighbourTour(p, count);
  const before = tourLength(p, t);
  const res = twoOpt(p, t, neighbourLists(p, count, count - 1));
  assert.ok(res.done && res.moves > 0);
  assert.ok(isPermutation(t, count));
  assert.ok(tourLength(p, t) < before);
  for (let i = 0; i < count; i++) {
    for (let j = i + 2; j < count; j++) {
      if (i === 0 && j === count - 1) continue;
      assert.ok(!segmentsCross(p, t[i], t[i + 1], t[j], t[(j + 1) % count]), `edges ${i} and ${j} cross`);
    }
  }
});

test('2-opt with short lists still never lengthens the tour', () => {
  const count = 2000;
  const p = scatter(3, count, 400);
  const t = nearestNeighbourTour(p, count);
  const before = tourLength(p, t);
  twoOpt(p, t, neighbourLists(p, count, 8));
  const after = tourLength(p, t);
  assert.ok(isPermutation(t, count));
  // Greedy tours run about 25% over optimal; 2-opt recovers most of that.
  assert.ok(after < before * 0.92, `${before} -> ${after}`);
});

test('2-opt stops when told to and can be resumed', () => {
  const count = 1500;
  const p = scatter(9, count, 300);
  const t = nearestNeighbourTour(p, count);
  const nb = neighbourLists(p, count, 8);
  let calls = 0;
  const first = twoOpt(p, t, nb, () => ++calls > 2);
  assert.equal(first.done, false);
  const second = twoOpt(p, t, nb);
  assert.equal(second.done, true);
  assert.ok(isPermutation(t, count));
});
