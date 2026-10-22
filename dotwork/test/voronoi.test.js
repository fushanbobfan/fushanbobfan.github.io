import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuckets, nearest, labelPixels } from '../src/voronoi.js';
import { createRng } from '../src/rng.js';

function brute(points, count, x, y) {
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < count; i++) {
    const d2 = (points[2 * i] - x) ** 2 + (points[2 * i + 1] - y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return { best, bestD2 };
}

function scatter(seed, count, width, height, clump = false) {
  const rng = createRng(seed);
  const p = new Float64Array(2 * count);
  for (let i = 0; i < count; i++) {
    // Clumped sets put most dots in one corner, leaving long empty searches.
    const k = clump && i > 2 ? 0.15 : 1;
    p[2 * i] = rng.next() * width * k;
    p[2 * i + 1] = rng.next() * height * k;
  }
  return p;
}

test('every bucket item is listed exactly once', () => {
  const p = scatter(1, 300, 120, 80);
  const b = createBuckets(p, 300, 120, 80);
  assert.equal(b.start[b.cols * b.rows], 300);
  assert.deepEqual([...b.items].sort((a, c) => a - c), [...Array(300).keys()]);
});

for (const [name, clump] of [['even', false], ['clumped', true]]) {
  test(`grid search agrees with brute force on ${name} dots`, () => {
    const W = 97;
    const H = 61;
    for (const count of [1, 2, 7, 150]) {
      const p = scatter(count * 13 + (clump ? 1 : 0), count, W, H, clump);
      const labels = labelPixels(p, count, W, H);
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const got = labels[py * W + px];
          const want = brute(p, count, px + 0.5, py + 0.5);
          const d2 = (p[2 * got] - px - 0.5) ** 2 + (p[2 * got + 1] - py - 0.5) ** 2;
          assert.equal(d2, want.bestD2, `pixel ${px},${py} with ${count} dots`);
        }
      }
    }
  });
}

test('queries outside the picture still find the nearest dot', () => {
  const p = scatter(5, 40, 50, 50);
  const b = createBuckets(p, 40, 50, 50);
  for (const [x, y] of [[-20, -20], [80, 10], [25, 200]]) {
    const i = nearest(b, p, x, y);
    assert.equal((p[2 * i] - x) ** 2 + (p[2 * i + 1] - y) ** 2, brute(p, 40, x, y).bestD2);
  }
});

test('no dots labels every pixel -1', () => {
  assert.deepEqual([...labelPixels(new Float64Array(0), 0, 3, 2)], [-1, -1, -1, -1, -1, -1]);
});

test('a mask skips blank pixels and leaves the rest exact', () => {
  const W = 40;
  const H = 30;
  const p = scatter(31, 25, W, H);
  const mask = new Float32Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = i % 3 === 0 ? 0 : 0.5;
  const labels = labelPixels(p, 25, W, H, undefined, mask);
  for (let i = 0; i < W * H; i++) {
    const px = i % W;
    const py = Math.floor(i / W);
    if (mask[i] === 0) assert.equal(labels[i], -1);
    else {
      const k = labels[i];
      assert.equal((p[2 * k] - px - 0.5) ** 2 + (p[2 * k + 1] - py - 0.5) ** 2, brute(p, 25, px + 0.5, py + 0.5).bestD2);
    }
  }
});
