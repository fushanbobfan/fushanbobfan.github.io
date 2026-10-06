import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHI, SEEDS, grow, edgeLength } from '../src/tiling.js';
import { patchRadii } from '../src/view.js';
import { ARC_RULES, arcEnds, arcsFor, hasArcs } from '../src/arcs.js';

const key = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

for (const id of ['p2-sun', 'p2-star']) {
  test(`${id}: arcs of each colour join in pairs across every edge inside the patch`, () => {
    const g = 6;
    const tris = grow(id, g);
    const arcs = arcsFor(tris, edgeLength(g));
    assert.equal(arcs.length, tris.length * 2);
    const inner = patchRadii(SEEDS[id].build()).inner - 0.05;
    const ends = new Map();
    for (const arc of arcs) {
      for (const p of arcEnds(arc)) {
        if (Math.hypot(...p) > inner) continue;
        const k = `${arc.colour}@${key(p)}`;
        ends.set(k, (ends.get(k) || 0) + 1);
      }
    }
    assert.ok(ends.size > 100);
    for (const [k, n] of ends) assert.equal(n, 2, `loose arc end ${k}`);
  });
}

test('arc ends lie on the sides of their triangle', () => {
  const tris = grow('p2-sun', 3);
  const arcs = arcsFor(tris, edgeLength(3));
  arcs.forEach((arc, i) => {
    const t = tris[Math.floor(i / 2)];
    for (const p of arcEnds(arc)) {
      const onSide = [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ].some(([u, v]) => Math.abs(dist(u, p) + dist(p, v) - dist(u, v)) < 1e-9);
      assert.ok(onSide);
    }
    assert.ok(Math.abs(arc.sweep) < Math.PI);
  });
});

test('the two arcs of a kite or a dart reach the same point of its axis', () => {
  const [kiteTip, kiteTail] = ARC_RULES.kite;
  assert.ok(Math.abs(kiteTip.radius + kiteTail.radius - 1) < 1e-12);
  const [dartTip, dartDent] = ARC_RULES.dart;
  assert.ok(Math.abs(dartTip.radius + dartDent.radius - 1 / PHI) < 1e-12);
});

test('rhombi have no arcs', () => {
  assert.equal(hasArcs('p3'), false);
  assert.equal(arcsFor(grow('p3-sun', 2), 1).length, 0);
});
