import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, byId, cellOps, apply, basis } from '../src/groups.js';
import { cellCentres, elements, orderOf } from '../src/elements.js';

const count = (id) => {
  const by = {};
  for (const c of cellCentres(byId(id))) by[c.order] = (by[c.order] || 0) + 1;
  return by;
};

test('rotation orders of the generating matrices', () => {
  assert.equal(orderOf([-1, 0, 0, -1]), 2);
  assert.equal(orderOf([0, -1, 1, -1]), 3);
  assert.equal(orderOf([0, -1, 1, 0]), 4);
  assert.equal(orderOf([1, -1, 1, 0]), 6);
});

test('rotation centres per cell match the standard counts', () => {
  assert.deepEqual(count('p1'), {});
  assert.deepEqual(count('pg'), {});
  assert.deepEqual(count('p2'), { 2: 4 });
  assert.deepEqual(count('cmm'), { 2: 8 });
  assert.deepEqual(count('p4'), { 2: 2, 4: 2 });
  assert.deepEqual(count('p3'), { 3: 3 });
  assert.deepEqual(count('p6'), { 2: 3, 3: 2, 6: 1 });
});

// Group the centres of a cell into orbits under the whole group.
function centreOrbits(g) {
  const cs = cellCentres(g);
  const key = (u, v) => `${(((u % 1) + 1) % 1).toFixed(4)},${(((v % 1) + 1) % 1).toFixed(4)}`.replace(/1\.0000/g, '0.0000');
  const seen = new Set();
  const orbits = [];
  for (const c of cs) {
    if (seen.has(key(c.u, c.v))) continue;
    for (const o of cellOps(g)) {
      const [u, v] = apply(o, [c.u, c.v]);
      seen.add(key(u, v));
    }
    orbits.push(c.order);
  }
  return orbits.sort();
}

test('orbits of rotation centres are the digits of the orbifold symbol', () => {
  for (const g of GROUPS) {
    const digits = [...g.orbifold].filter((ch) => /[2-6]/.test(ch)).map(Number).sort();
    assert.deepEqual(centreOrbits(g), digits, g.id);
  }
});

const square = { x0: -0.001, y0: -0.001, x1: 0.999, y1: 0.999 };

test('pm has mirrors only, pg glides only, cm both', () => {
  const kinds = (id) => {
    const g = byId(id);
    const { lines } = elements(g, basis(g.lattice), square);
    return { mirrors: lines.filter((l) => l.mirror).length, glides: lines.filter((l) => !l.mirror).length };
  };
  assert.deepEqual(kinds('pm'), { mirrors: 2, glides: 0 });
  assert.deepEqual(kinds('pg'), { mirrors: 0, glides: 2 });
  assert.deepEqual(kinds('cm'), { mirrors: 2, glides: 2 });
});

test('every rotation centre in the view is fixed by a rotation of the group', () => {
  for (const g of GROUPS) {
    for (const c of cellCentres(g)) {
      const fixed = cellOps(g).some((o) => {
        if (o.m[0] === 1 && o.m[3] === 1 && o.m[1] === 0 && o.m[2] === 0) return false;
        const [u, v] = apply(o, [c.u, c.v]);
        return [u - c.u, v - c.v].every((d) => Math.abs(d - Math.round(d)) < 1e-9);
      });
      assert.ok(fixed, g.id);
    }
  }
});

test('mirror lines in p4m run in four directions, p4g has mirrors in two', () => {
  const dirs = (id) => {
    const g = byId(id);
    const { lines } = elements(g, basis(g.lattice), { x0: -2, y0: -2, x1: 2, y1: 2 });
    return new Set(lines.filter((l) => l.mirror).map((l) => Math.atan2(l.dy, l.dx).toFixed(3))).size;
  };
  assert.equal(dirs('p4m'), 4);
  assert.equal(dirs('p4g'), 2);
  assert.equal(dirs('p6m'), 6);
  assert.equal(dirs('pgg'), 0);
});
