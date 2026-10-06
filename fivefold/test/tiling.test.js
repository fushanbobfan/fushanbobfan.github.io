import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHI,
  SEEDS,
  SYSTEMS,
  assemble,
  countKinds,
  cross,
  grow,
  seedsFor,
  subdivide,
  triangleArea,
} from '../src/tiling.js';

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const close = (x, y, eps = 1e-9) => Math.abs(x - y) <= eps;
const GOLDEN = ['kite', 'thin'];

// The length of a whole tile's long edge: kites and darts have two edge
// lengths, rhombi only one.
function longSide(t) {
  return GOLDEN.includes(t.kind) || t.kind === 'thick' ? dist(t.a, t.b) : dist(t.b, t.c);
}

function checkShape(t) {
  const ab = dist(t.a, t.b);
  const ac = dist(t.a, t.c);
  const bc = dist(t.b, t.c);
  assert.ok(close(ab, ac, 1e-9), `${t.kind}: legs ${ab} and ${ac} differ`);
  if (GOLDEN.includes(t.kind)) assert.ok(close(ab / bc, PHI, 1e-9), `${t.kind}: legs/base ${ab / bc}`);
  else assert.ok(close(bc / ab, PHI, 1e-9), `${t.kind}: base/legs ${bc / ab}`);
}

const total = (tris) => tris.reduce((s, t) => s + triangleArea(t), 0);

for (const id of Object.keys(SEEDS)) {
  test(`${id}: every triangle is a Robinson triangle shrinking by the golden ratio`, () => {
    let tris = SEEDS[id].build();
    const size = longSide(tris[0]);
    for (let g = 0; g <= 6; g++) {
      for (const t of tris) {
        checkShape(t);
        assert.ok(close(longSide(t), size * Math.pow(PHI, -g), 1e-9));
        assert.ok(SYSTEMS[SEEDS[id].system].kinds.includes(t.kind));
      }
      tris = subdivide(tris);
    }
  });

  test(`${id}: substitution keeps the covered area`, () => {
    const area0 = total(grow(id, 0));
    for (let g = 1; g <= 7; g++) assert.ok(close(total(grow(id, g)), area0, 1e-9));
  });

  test(`${id}: halves pair into whole tiles everywhere except the rim`, () => {
    const tris = grow(id, 6);
    const { tiles, halves } = assemble(tris, SEEDS[id].system);
    assert.equal(tiles.length * 2 + halves.length, tris.length);
    assert.ok(halves.length < tris.length * 0.1, `${halves.length} of ${tris.length} unpaired`);
    // An unpaired half must touch the rim of the seed patch.
    const rim = Math.max(...SEEDS[id].build().flatMap((t) => [t.a, t.b, t.c].map((p) => Math.hypot(...p))));
    for (const h of halves) {
      const reach = Math.max(...[h.a, h.b, h.c].map((p) => Math.hypot(...p)));
      assert.ok(reach > rim * 0.45, `unpaired half deep inside the patch at radius ${reach}`);
    }
    for (const tile of tiles) {
      const sides = tile.points.map((p, i) => dist(p, tile.points[(i + 1) % 4]));
      if (SEEDS[id].system === 'p3') {
        for (const s of sides) assert.ok(close(s, sides[0], 1e-9), 'rhombus sides differ');
      } else {
        const sorted = [...sides].sort((x, y) => x - y);
        assert.ok(close(sorted[0], sorted[1], 1e-9) && close(sorted[2], sorted[3], 1e-9));
        assert.ok(close(sorted[3] / sorted[0], PHI, 1e-9), 'kite or dart sides not in golden ratio');
      }
    }
  });

  test(`${id}: corners inside the patch close up to a full turn`, () => {
    const tris = grow(id, 5);
    const sums = new Map();
    const key = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
    const angle = (o, p, q) =>
      Math.acos(
        ((p[0] - o[0]) * (q[0] - o[0]) + (p[1] - o[1]) * (q[1] - o[1])) / (dist(o, p) * dist(o, q)),
      );
    for (const t of tris) {
      for (const [o, p, q] of [
        [t.a, t.b, t.c],
        [t.b, t.c, t.a],
        [t.c, t.a, t.b],
      ]) {
        const k = key(o);
        const prev = sums.get(k) || { p: o, sum: 0 };
        prev.sum += angle(o, p, q);
        sums.set(k, prev);
      }
    }
    let inner = 0;
    for (const { p, sum } of sums.values()) {
      if (Math.hypot(...p) > 0.4) continue;
      inner++;
      assert.ok(close(sum, 2 * Math.PI, 1e-7), `angle sum ${sum} at ${p}`);
    }
    assert.ok(inner > 10);
  });

  test(`${id}: no two triangles overlap`, () => {
    const tris = grow(id, 4);
    const inside = (t, p) => {
      const s1 = cross(t.a, t.b, p);
      const s2 = cross(t.b, t.c, p);
      const s3 = cross(t.c, t.a, p);
      return (s1 > 1e-12 && s2 > 1e-12 && s3 > 1e-12) || (s1 < -1e-12 && s2 < -1e-12 && s3 < -1e-12);
    };
    let x = 0.123;
    for (let i = 0; i < 400; i++) {
      x = (x * 9301 + 0.49297) % 1;
      const r = 0.9 * Math.sqrt(x);
      const th = ((x * 7919) % 1) * 2 * Math.PI;
      const p = [r * Math.cos(th), r * Math.sin(th)];
      const hits = tris.filter((t) => inside(t, p)).length;
      assert.ok(hits <= 1, `point ${p} lies in ${hits} triangles`);
    }
  });
}

test('the ratio of the two tiles tends to the golden ratio', () => {
  for (const id of ['p2-sun', 'p3-sun']) {
    const counts = countKinds(grow(id, 10));
    const [x, y] = SYSTEMS[SEEDS[id].system].kinds.map((k) => counts[k]);
    assert.ok(Math.abs(Math.max(x, y) / Math.min(x, y) - PHI) < 1e-3, JSON.stringify(counts));
  }
});

test('the sun of kites starts as five whole kites', () => {
  const { tiles, halves } = assemble(grow('p2-sun', 0), 'p2');
  assert.equal(tiles.length, 5);
  assert.equal(halves.length, 0);
  assert.deepEqual(new Set(tiles.map((t) => t.kind)), new Set(['kite']));
});

test('the star of rhombi starts as five whole thick rhombi', () => {
  const { tiles, halves } = assemble(grow('p3-star', 0), 'p3');
  assert.equal(tiles.length, 5);
  assert.equal(halves.length, 0);
});

test('tile axes point in one of ten directions 36 degrees apart', () => {
  for (const id of Object.keys(SEEDS)) {
    const { tiles } = assemble(grow(id, 4), SEEDS[id].system);
    const axes = new Set(tiles.map((t) => t.axis));
    assert.ok(axes.size <= 10);
    for (const a of axes) assert.equal((a - tiles[0].axis + 360) % 36, 0, `${id}: axis ${a}`);
  }
});

test('seeds are listed per system', () => {
  assert.deepEqual(
    seedsFor('p2').map((s) => s.id),
    ['p2-sun', 'p2-star'],
  );
  assert.throws(() => grow('nope', 1));
});
