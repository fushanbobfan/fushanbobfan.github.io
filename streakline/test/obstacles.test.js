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
