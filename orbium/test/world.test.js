import test from 'node:test';
import assert from 'node:assert/strict';
import { World, kernelGrid, validateRule, torusDelta, DEFAULT_RULE } from '../src/world.js';
import { kernelShell } from '../src/rules.js';

test('kernel weights sum to one and stay inside the radius', () => {
  const n = 64;
  const k = kernelGrid(n, 9, [1, 1 / 3]);
  const sum = k.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  assert.equal(k[0], 0);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x > n / 2 ? x - n : x;
      const dy = y > n / 2 ? y - n : y;
      if (Math.hypot(dx, dy) >= 9) assert.equal(k[y * n + x], 0);
    }
  }
});

test('the sensed field equals a direct periodic convolution', () => {
  const n = 32;
  const rule = { R: 5, T: 10, mu: 0.15, sigma: 0.015, rings: [1] };
  const w = new World(n, rule);
  for (let i = 0; i < n * n; i++) w.cells[i] = ((i * 2654435761) % 1000) / 1000;
  const u = w.sense();
  let total = 0;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) total += kernelShell(Math.hypot(dx, dy), 5, [1]);
  for (const [x, y] of [[0, 0], [7, 3], [31, 31], [16, 2]]) {
    let want = 0;
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const wgt = kernelShell(Math.hypot(dx, dy), 5, [1]) / total;
        want += wgt * w.cells[((y + dy + n) % n) * n + ((x + dx + n) % n)];
      }
    }
    assert.ok(Math.abs(u[y * n + x] - want) < 1e-12, `(${x}, ${y})`);
  }
});

test('an empty world decays nowhere and a full world empties under a low mu', () => {
  const w = new World(32, DEFAULT_RULE);
  w.step();
  assert.equal(w.mass(), 0);
  w.cells.fill(1);
  for (let i = 0; i < 12; i++) w.step();
  assert.equal(w.mass(), 0);
  assert.ok(Math.abs(w.time - 1.3) < 1e-12);
});

test('values stay in [0, 1] after a step', () => {
  const w = new World(64, DEFAULT_RULE);
  for (let i = 0; i < w.cells.length; i++) w.cells[i] = (i % 17) / 16;
  for (let s = 0; s < 3; s++) w.step();
  for (const v of w.cells) assert.ok(v >= 0 && v <= 1);
});

test('placing wraps round the edges and quarter turns rotate the pattern', () => {
  const w = new World(32, DEFAULT_RULE);
  const p = { width: 3, height: 2, data: Float64Array.from([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) };
  w.place(p, 31, 31);
  assert.equal(w.cells[31 * 32 + 31], 0.1);
  assert.equal(w.cells[31 * 32 + 0], 0.2);
  assert.equal(w.cells[0 * 32 + 31], 0.4);
  w.clear();
  w.place(p, 0, 0, { rotate: 1 });
  assert.equal(w.cells[0 * 32 + 0], 0.4);
  assert.equal(w.cells[0 * 32 + 1], 0.1);
  assert.equal(w.cells[2 * 32 + 1], 0.3);
  w.clear();
  w.place(p, 0, 0, { rotate: 2 });
  assert.equal(w.cells[0], 0.6);
  assert.equal(w.cells[1 * 32 + 2], 0.1);
});

test('the centroid wraps across the seam', () => {
  const w = new World(32, DEFAULT_RULE);
  w.cells[5 * 32 + 31] = 1;
  w.cells[5 * 32 + 1] = 1;
  const c = w.centroid();
  assert.ok(Math.min(c.x, 32 - c.x) < 1e-9);
  assert.ok(Math.abs(c.y - 5) < 1e-9);
  assert.equal(new World(32).centroid(), null);
  assert.deepEqual(torusDelta({ x: 30, y: 1 }, { x: 2, y: 31 }, 32), { dx: 4, dy: -2 });
});

test('rules outside their ranges are refused', () => {
  assert.throws(() => validateRule({ ...DEFAULT_RULE, R: 1 }), RangeError);
  assert.throws(() => validateRule({ ...DEFAULT_RULE, mu: 0 }), RangeError);
  assert.throws(() => validateRule({ ...DEFAULT_RULE, sigma: NaN }), RangeError);
  assert.throws(() => validateRule({ ...DEFAULT_RULE, rings: [] }), RangeError);
  assert.throws(() => new World(48), RangeError);
});
