import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, basis, cellOps, apply, toFrac, toCart } from '../src/groups.js';
import { anchor, copies, reachOf, applyAffine } from '../src/tiling.js';

const view = { x0: -3.2, y0: -2.1, x1: 4.7, y1: 3.3 };
const inView = ([x, y]) => x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1;

test('anchoring moves the first point into the unit cell by a lattice vector', () => {
  const B = basis('hexagonal');
  const pts = anchor([toCart([3.4, -2.2], B), toCart([3.9, -1.5], B)], B);
  const [u, v] = toFrac(pts[0], B);
  assert.ok(u >= 0 && u < 1 && v >= 0 && v < 1);
  const [u2, v2] = toFrac(pts[1], B);
  assert.ok(Math.abs(u2 - u - 0.5) < 1e-12 && Math.abs(v2 - v - 0.7) < 1e-12);
});

test('every image of a point that lands in the view is among the copies', () => {
  for (const g of GROUPS) {
    const B = basis(g.lattice);
    const p = toCart([0.23, 0.61], B);
    const made = copies(g, B, view).map((t) => applyAffine(t, p));
    const pf = toFrac(p, B);
    for (const o of cellOps(g)) {
      for (let i = -8; i <= 8; i++) {
        for (let j = -8; j <= 8; j++) {
          const [u, v] = apply(o, pf);
          const q = toCart([u + i, v + j], B);
          if (!inView(q)) continue;
          assert.ok(made.some((m) => Math.hypot(m[0] - q[0], m[1] - q[1]) < 1e-9), `${g.id} misses an image`);
        }
      }
    }
  }
});

test('a stroke that runs out of its cell is still drawn where it re-enters the view', () => {
  const g = GROUPS.find((x) => x.id === 'p4m');
  const B = basis(g.lattice);
  const stroke = anchor([[0.5, 0.5], [3.5, 0.5]], B);
  const reach = reachOf(stroke, B);
  assert.ok(reach >= 2.5 - 1e-12);
  const far = { x0: -0.7, y0: 0.2, x1: -0.3, y1: 0.8 };
  const end = stroke[1];
  const lands = (r) => copies(g, B, far, r).map((t) => applyAffine(t, end))
    .some(([x, y]) => x >= far.x0 && x <= far.x1 && y >= far.y0 && y <= far.y1);
  assert.equal(lands(reach), true);
  assert.equal(lands(0), false);
});

test('copies are distinct', () => {
  for (const g of GROUPS) {
    const B = basis(g.lattice);
    const p = toCart([0.23, 0.61], B);
    const imgs = copies(g, B, view).map((t) => applyAffine(t, p).map((v) => v.toFixed(9)).join());
    assert.equal(new Set(imgs).size, imgs.length, g.id);
  }
});
