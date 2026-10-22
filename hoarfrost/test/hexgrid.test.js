import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeGrid, cellCount, hexDistance, rotate, reflect, DIRECTIONS,
} from '../src/hexgrid.js';

test('a patch of radius n holds 3n(n+1)+1 cells and marks its outer ring as boundary', () => {
  for (const n of [1, 2, 5, 40]) {
    const g = makeGrid(n);
    assert.equal(g.count, cellCount(n));
    const ring = g.boundary.reduce((a, b) => a + b, 0);
    assert.equal(ring, 6 * n);
  }
  assert.throws(() => makeGrid(0), RangeError);
  assert.throws(() => makeGrid(2.5), RangeError);
});

test('index and coordinates agree, and cells outside the patch have no index', () => {
  const g = makeGrid(6);
  for (let c = 0; c < g.count; c++) assert.equal(g.index(g.q[c], g.r[c]), c);
  assert.equal(g.index(7, 0), -1);
  assert.equal(g.index(4, 4), -1);
  assert.equal(g.q[g.center], 0);
  assert.equal(g.r[g.center], 0);
});

test('every interior cell has six neighbours one step away, and neighbourhood is symmetric', () => {
  const g = makeGrid(8);
  for (let c = 0; c < g.count; c++) {
    for (let k = 0; k < 6; k++) {
      const n = g.neighbors[c * 6 + k];
      if (g.boundary[c] === 0) assert.ok(n >= 0);
      if (n < 0) continue;
      assert.equal(hexDistance(g.q[n] - g.q[c], g.r[n] - g.r[c]), 1);
      assert.ok(g.neighbors.subarray(n * 6, n * 6 + 6).includes(c));
    }
  }
});

test('boundary cells miss exactly the neighbours that would fall outside', () => {
  const g = makeGrid(5);
  const corner = g.index(5, 0);
  const edge = g.index(3, 2);
  const missing = (c) => [...g.neighbors.subarray(c * 6, c * 6 + 6)].filter((n) => n < 0).length;
  assert.equal(missing(corner), 3);
  assert.equal(missing(edge), 2);
});

test('six rotations by 60 degrees return to the start and keep the distance from the centre', () => {
  for (const [q, r] of [[3, -1], [0, 4], [-2, -2]]) {
    let p = [q, r];
    for (let t = 0; t < 6; t++) {
      p = rotate(...p);
      assert.equal(hexDistance(...p), hexDistance(q, r));
    }
    assert.deepEqual(p, [q, r]);
    assert.deepEqual(rotate(q, r, 3), [0 - q, 0 - r]);
    assert.deepEqual(rotate(q, r, -1), rotate(q, r, 5));
  }
});

test('rotation maps the neighbour directions onto each other in order', () => {
  for (let k = 0; k < 6; k++) {
    assert.deepEqual(rotate(...DIRECTIONS[k]), DIRECTIONS[(k + 1) % 6]);
  }
});

test('reflection fixes the q axis, is its own inverse and keeps distances', () => {
  assert.deepEqual(reflect(4, 0), [4, 0]);
  for (const [q, r] of [[3, -1], [0, 4], [-2, 5]]) {
    assert.deepEqual(reflect(...reflect(q, r)), [q, r]);
    assert.equal(hexDistance(...reflect(q, r)), hexDistance(q, r));
  }
});
