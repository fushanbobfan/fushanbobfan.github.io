import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, byId, cellOps, compose, sameModLattice, det, basis, cartesian, apply, toFrac, toCart } from '../src/groups.js';

const ORDER = { p1: 1, p2: 2, pm: 2, pg: 2, cm: 2, pmm: 4, pmg: 4, pgg: 4, cmm: 4, p4: 4, p4m: 8, p4g: 8, p3: 3, p3m1: 6, p31m: 6, p6: 6, p6m: 12 };

test('there are seventeen groups with distinct names and orbifold symbols', () => {
  assert.equal(GROUPS.length, 17);
  assert.equal(new Set(GROUPS.map((g) => g.id)).size, 17);
  assert.equal(new Set(GROUPS.map((g) => g.orbifold)).size, 17);
});

test('each group has the point-group order of the International Tables', () => {
  for (const g of GROUPS) assert.equal(g.ops.length, ORDER[g.id], g.id);
});

test('operations close under composition modulo the lattice', () => {
  for (const g of GROUPS) {
    const ops = cellOps(g);
    for (const f of ops) {
      for (const h of ops) {
        const fh = compose(f, h);
        assert.ok(ops.some((o) => sameModLattice(o, fh)), `${g.id}: product not in the group`);
      }
    }
  }
});

test('every operation has an inverse in the group', () => {
  for (const g of GROUPS) {
    const ops = cellOps(g);
    for (const f of ops) {
      assert.ok(ops.some((h) => sameModLattice(compose(f, h), ops[0])), `${g.id}: no inverse`);
    }
  }
});

test('operations are isometries of their lattice', () => {
  for (const g of GROUPS) {
    const B = basis(g.lattice);
    for (const o of g.ops) {
      const [a, b, c, d] = cartesian(o, B);
      // columns orthonormal
      assert.ok(Math.abs(a * a + b * b - 1) < 1e-12, g.id);
      assert.ok(Math.abs(c * c + d * d - 1) < 1e-12, g.id);
      assert.ok(Math.abs(a * c + b * d) < 1e-12, g.id);
    }
  }
});

test('the Cartesian form agrees with the fractional form', () => {
  const g = byId('p31m');
  const B = basis(g.lattice);
  const p = [0.31, 0.17];
  for (const o of g.ops) {
    const [a, b, c, d, e, f] = cartesian(o, B);
    const [x, y] = toCart(p, B);
    const want = toCart(apply(o, p), B);
    assert.ok(Math.abs(a * x + c * y + e - want[0]) < 1e-12);
    assert.ok(Math.abs(b * x + d * y + f - want[1]) < 1e-12);
  }
});

test('fractional and Cartesian coordinates round-trip on every lattice', () => {
  for (const lat of ['oblique', 'rectangular', 'square', 'hexagonal']) {
    const B = basis(lat);
    const [u, v] = toFrac(toCart([0.4, -1.3], B), B);
    assert.ok(Math.abs(u - 0.4) < 1e-12 && Math.abs(v + 1.3) < 1e-12, lat);
  }
});

// A reflection-type operation is a true mirror when some lattice translate of
// it fixes a line, i.e. its square's translation lies in (I + M) Z^2.
function hasMirror(g) {
  for (const o of cellOps(g)) {
    if (det(o) !== -1) continue;
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const s = compose({ m: o.m, t: [o.t[0] + i, o.t[1] + j] }, { m: o.m, t: [o.t[0] + i, o.t[1] + j] });
        if (Math.abs(s.t[0]) < 1e-9 && Math.abs(s.t[1]) < 1e-9) return true;
      }
    }
  }
  return false;
}

function rotationOrders(g) {
  const orders = new Set();
  for (const o of g.ops) {
    if (det(o) !== 1) continue;
    let p = o;
    for (let n = 1; n <= 6; n++) {
      if (p.m[0] === 1 && p.m[1] === 0 && p.m[2] === 0 && p.m[3] === 1) {
        if (n > 1) orders.add(n);
        break;
      }
      p = compose(o, p);
    }
  }
  return orders;
}

test('the orbifold symbol matches the mirrors in the group', () => {
  for (const g of GROUPS) assert.equal(hasMirror(g), g.orbifold.includes('*'), g.id);
});

test('the largest rotation in each group matches its orbifold digits', () => {
  for (const g of GROUPS) {
    const digits = [...g.orbifold].filter((ch) => /[2-6]/.test(ch)).map(Number);
    const top = Math.max(1, ...rotationOrders(g));
    assert.equal(top, Math.max(1, ...digits), g.id);
  }
});

test('glide-only groups have reflections but no mirrors', () => {
  for (const id of ['pg', 'pgg']) {
    const g = byId(id);
    assert.ok(g.ops.some((o) => det(o) === -1), id);
    assert.equal(hasMirror(g), false, id);
  }
});

test('p3m1 has mirrors through every threefold centre and p31m does not', () => {
  const onMirror = (g, p) => g.ops.some((o) => {
    if (det(o) !== -1) return false;
    const q = apply(o, p);
    return [q[0] - p[0], q[1] - p[1]].every((v) => Math.abs(v - Math.round(v)) < 1e-9);
  });
  const centre = [1 / 3, 2 / 3];
  assert.equal(onMirror(byId('p3m1'), centre), true);
  assert.equal(onMirror(byId('p31m'), centre), false);
  assert.equal(onMirror(byId('p31m'), [0, 0]), true);
});
