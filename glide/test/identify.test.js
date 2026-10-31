import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS } from '../src/groups.js';
import { features, identify, randomMotif, rng } from '../src/identify.js';

test('the chart names every group from its own symmetry elements', () => {
  for (const g of GROUPS) {
    const { id } = identify(features(g));
    assert.equal(id, g.id);
  }
});

test('the answer does not depend on the shape of a rectangular or oblique cell', () => {
  for (const g of GROUPS.filter((x) => x.lattice === 'rectangular' || x.lattice === 'oblique')) {
    for (const shape of [{ ratio: 0.45, angle: 62 }, { ratio: 1.4, angle: 81 }]) {
      assert.equal(identify(features(g, shape)).id, g.id, `${g.id} ${JSON.stringify(shape)}`);
    }
  }
});

test('the chart separates the look-alike pairs', () => {
  const f = Object.fromEntries(GROUPS.map((g) => [g.id, features(g)]));
  assert.equal(f.pmm.centresOnMirrors, true);
  assert.equal(f.cmm.centresOnMirrors, false);
  assert.equal(f.p3m1.centresOnMirrors, true);
  assert.equal(f.p31m.centresOnMirrors, false);
  assert.equal(f.p4m.topCentresOnMirrors, true);
  assert.equal(f.p4g.topCentresOnMirrors, false);
  assert.equal(f.pmg.mirrorDirections, 1);
  assert.equal(f.cm.glides, true);
  assert.equal(f.pm.glides, false);
});

test('every path through the chart starts with the rotation and ends in a yes or no', () => {
  for (const g of GROUPS) {
    const { steps } = identify(features(g));
    assert.match(steps[0].q, /rotation/);
    assert.ok(steps.length >= 2);
    for (const s of steps.slice(1)) assert.ok(s.a === 'yes' || s.a === 'no');
  }
});

test('puzzles replay from their seed', () => {
  const a = randomMotif(42, ['#fff', '#000']);
  const b = randomMotif(42, ['#fff', '#000']);
  assert.deepEqual(a, b);
  assert.notDeepEqual(randomMotif(43, ['#fff', '#000']), a);
  const r = rng(7);
  for (let i = 0; i < 1000; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1);
  }
});

test('a motif starts inside the unit cell', () => {
  for (let s = 1; s < 50; s++) {
    for (const st of randomMotif(s, ['#fff'])) {
      const [u, v] = st.pts[0];
      assert.ok(u >= 0 && u < 1 && v >= 0 && v < 1);
      assert.ok(st.pts.length >= 19);
    }
  }
});
