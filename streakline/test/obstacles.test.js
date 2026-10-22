import test from 'node:test';
import assert from 'node:assert/strict';
import { contains, rasterize, frontalHeight } from '../src/obstacles.js';

const count = (m) => m.reduce((s, v) => s + v, 0);

test('a cylinder covers about pi r^2 cells and is centred where asked', () => {
  const shape = { kind: 'cylinder', x: 40, y: 30, size: 20, angle: 0 };
  const m = rasterize(shape, 100, 60);
  const area = count(m);
  assert.ok(Math.abs(area - Math.PI * 100) / (Math.PI * 100) < 0.04, `area ${area}`);
  assert.equal(frontalHeight(m, 100, 60), 21);
  assert.ok(m[30 * 100 + 40]);
  assert.ok(!m[30 * 100 + 51]);
});

test('a square turned 45 degrees becomes a diamond', () => {
  const sq = { kind: 'square', x: 0, y: 0, size: 10, angle: 45 };
  assert.ok(contains(sq, 6.9, 0));
  assert.ok(!contains(sq, 4.9, 4.9));
  assert.ok(contains({ ...sq, angle: 0 }, 4.9, 4.9));
});

test('a plate pitched nose up lifts its leading edge on screen', () => {
  // Flow runs left to right, so the leading edge is the left end. Screen y
  // grows downwards, so "up" means smaller y.
  const plate = { kind: 'plate', x: 0, y: 0, size: 20, angle: 20 };
  const a = (20 * Math.PI) / 180;
  const lead = [-10 * Math.cos(a) * 0.9, -10 * Math.sin(a) * 0.9];
  assert.ok(contains(plate, lead[0], lead[1]));
  assert.ok(!contains(plate, lead[0], -lead[1]));
});

test('a level plate is thin across the stream and none is empty', () => {
  const m = rasterize({ kind: 'plate', x: 30, y: 20, size: 24, angle: 0 }, 60, 40);
  assert.equal(frontalHeight(m, 60, 40), 3);
  assert.equal(count(rasterize({ kind: 'none', x: 30, y: 20, size: 24 }, 60, 40)), 0);
});

test('a NACA 0012 outline has the textbook area and thickness', async () => {
  const { nacaOutline } = await import('../src/obstacles.js');
  const poly = nacaOutline('0012', 1, 200);
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    area += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  area = Math.abs(area) / 2;
  assert.ok(Math.abs(area - 0.685 * 0.12) / (0.685 * 0.12) < 0.01, `area ${area}`);
  const vs = poly.map((p) => p[1]);
  assert.ok(Math.abs(Math.max(...vs) - Math.min(...vs) - 0.12) < 0.002);
  assert.ok(Math.abs(poly[0][0] - 0.5) < 1e-9 && Math.abs(poly[0][1]) < 1e-3);
});

test('a cambered section bulges up on screen and a pitched wing lifts its nose', async () => {
  const wing = { kind: 'airfoil', naca: '4412', x: 0, y: 0, size: 40, angle: 0 };
  // Just behind mid-chord the 4412 spans about v = -3.5 to +0.5 (up is
  // negative), so 1.5 below the chord is outside it but inside a 0012.
  assert.ok(contains(wing, 2, -3));
  assert.ok(!contains(wing, 2, 1.5));
  assert.ok(contains({ ...wing, naca: '0012' }, 2, 1.5));
  const pitched = { ...wing, naca: '0012', angle: 15 };
  const a = (15 * Math.PI) / 180;
  assert.ok(contains(pitched, -17 * Math.cos(a), -17 * Math.sin(a)));
  assert.ok(contains(pitched, 17 * Math.cos(a), 17 * Math.sin(a)));
  assert.ok(!contains(pitched, -17 * Math.cos(a), 17 * Math.sin(a)));
});
