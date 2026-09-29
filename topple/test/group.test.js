import test from 'node:test';
import assert from 'node:assert/strict';
import { add, identity, isRecurrent, sinkEdges } from '../src/group.js';

const eq = (a, b) => assert.deepEqual([...a], [...b]);

test('the identity of a 1x1 grid is empty and of a 2x2 grid is all twos', () => {
  eq(identity(1, 1), [0]);
  eq(identity(2, 2), [2, 2, 2, 2]);
});

test('the identity added to itself is itself', () => {
  for (const [w, h] of [[3, 3], [5, 4], [16, 16], [30, 21]]) {
    const e = identity(w, h);
    eq(add(w, h, e, e), e);
  }
});

test('adding the identity leaves recurrent configurations unchanged', () => {
  const w = 12;
  const h = 9;
  const e = identity(w, h);
  const full = new Uint32Array(w * h).fill(3);
  eq(add(w, h, full, e), full);
  const mixed = add(w, h, full, full.map((_, i) => (i * 7) % 5));
  assert.ok(isRecurrent(w, h, mixed));
  eq(add(w, h, mixed, e), mixed);
});

test('the identity is recurrent and has the symmetry of the rectangle', () => {
  const w = 24;
  const h = 18;
  const e = identity(w, h);
  assert.ok(isRecurrent(w, h, e));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      assert.equal(e[y * w + x], e[y * w + (w - 1 - x)]);
      assert.equal(e[y * w + x], e[(h - 1 - y) * w + x]);
    }
  }
});

test('the empty pile is not recurrent, the full pile is', () => {
  assert.equal(isRecurrent(4, 4, new Uint32Array(16)), false);
  assert.equal(isRecurrent(4, 4, new Uint32Array(16).fill(3)), true);
  assert.equal(isRecurrent(4, 4, new Uint32Array(16).fill(4)), false);
});

test('sink edges count the missing neighbours', () => {
  eq(sinkEdges(3, 2), [2, 1, 2, 2, 1, 2]);
  eq(sinkEdges(1, 1), [4]);
});
