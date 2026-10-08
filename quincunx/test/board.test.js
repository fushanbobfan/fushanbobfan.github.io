import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ballPosition, binCentre, binOf, dropMany, dropPath, layout, pegPosition } from '../src/board.js';
import { mulberry32 } from '../src/rng.js';

test('a path has one step per row and its bin is the number of right steps', () => {
  const path = dropPath(12, 0.5, mulberry32(1));
  assert.equal(path.length, 12);
  assert.ok(path.every((s) => s === 0 || s === 1));
  assert.equal(binOf(path), path.reduce((a, b) => a + b, 0));
});

test('bias 0 and 1 send every ball to the end bins', () => {
  const rng = mulberry32(2);
  assert.equal(binOf(dropPath(9, 0, rng)), 0);
  assert.equal(binOf(dropPath(9, 1, rng)), 9);
});

test('a per-row bias is applied row by row', () => {
  const bias = [1, 0, 1, 0, 1];
  assert.deepEqual([...dropPath(5, bias, mulberry32(3))], bias);
});

test('the same seed gives the same drops', () => {
  const a = dropMany(new Array(11).fill(0), 10, 0.5, mulberry32(42), 500);
  const b = dropMany(new Array(11).fill(0), 10, 0.5, mulberry32(42), 500);
  assert.deepEqual(a, b);
  assert.equal(a.reduce((x, y) => x + y, 0), 500);
});

test('pegs sit in a centred triangle and bins line up under the gaps', () => {
  const L = layout(6, 600, 500);
  const left = pegPosition(L, 3, 0);
  const right = pegPosition(L, 3, 3);
  assert.ok(Math.abs(L.cx - (left.x + right.x) / 2) < 1e-9);
  assert.ok(Math.abs(binCentre(L, 0) - (pegPosition(L, 5, 0).x - L.dx / 2)) < 1e-9);
  assert.ok(Math.abs(binCentre(L, 6) - (pegPosition(L, 5, 5).x + L.dx / 2)) < 1e-9);
  assert.ok(L.binTop < L.binBottom && L.binBottom <= 500);
  assert.ok(binCentre(L, 0) > 0 && binCentre(L, 6) < 600);
});

test('the layout stays inside the box for the largest board', () => {
  const L = layout(40, 320, 400);
  assert.ok(binCentre(L, 0) - L.dx / 2 >= 0);
  assert.ok(binCentre(L, 40) + L.dx / 2 <= 320);
  assert.ok(L.top - L.dy >= 0);
});

test('a ball moves continuously from the drop point into its bin', () => {
  const L = layout(8, 600, 500);
  const path = dropPath(8, 0.5, mulberry32(7));
  let prev = ballPosition(L, path, 0);
  for (let t = 0.01; t <= 40; t += 0.01) {
    const p = ballPosition(L, path, t);
    assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < L.dx * 0.1, `jump at t=${t.toFixed(2)}`);
    prev = p;
  }
  assert.ok(Math.abs(prev.x - binCentre(L, binOf(path))) < 1e-9);
  assert.equal(prev.landed, true);
});

test('a ball rests on top of the peg it reaches at each whole row', () => {
  const L = layout(5, 600, 500);
  const path = Uint8Array.from([1, 1, 0, 1, 0]);
  const lift = L.pegRadius + L.ballRadius;
  let k = 0;
  for (let r = 0; r < 5; r++) {
    const peg = pegPosition(L, r, k);
    const p = ballPosition(L, path, r + 1);
    assert.ok(Math.abs(p.x - peg.x) < 1e-9 && Math.abs(p.y - (peg.y - lift)) < 1e-9);
    k += path[r];
  }
});

test('a ball stops at the landing height it is given', () => {
  const L = layout(4, 400, 400);
  const p = ballPosition(L, Uint8Array.from([0, 0, 0, 0]), 50, L.binBottom - 30);
  assert.equal(p.y, L.binBottom - 30);
  assert.equal(p.landed, true);
});
