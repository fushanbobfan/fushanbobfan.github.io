import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES } from '../src/species.js';
import { speciesById, speciesRule, speciesPattern, zoom, fitScale } from '../src/patterns.js';
import { World, torusDelta } from '../src/world.js';

test('every species decodes, has a unique id and a valid rule', () => {
  const ids = new Set();
  for (const s of SPECIES) {
    assert.ok(!ids.has(s.id), s.id);
    ids.add(s.id);
    const p = speciesPattern(s);
    assert.ok(p.width >= 10 && p.height >= 10, s.id);
    assert.ok(p.data.some((v) => v > 0.5), s.id);
    const w = new World(64, speciesRule(s));
    assert.equal(w.rule.R, s.rule.R);
    assert.ok(['glides', 'circles', 'stays'].includes(s.motion));
  }
  assert.equal(speciesById('orbium').code, 'O2u');
  assert.equal(speciesById('nope'), null);
});

test('zooming doubles each cell and keeps values', () => {
  const p = { width: 2, height: 1, data: Float64Array.from([0.25, 0.75]) };
  const z = zoom(p, 2);
  assert.equal(z.width, 4);
  assert.equal(z.height, 2);
  assert.deepEqual(Array.from(z.data), [0.25, 0.25, 0.75, 0.75, 0.25, 0.25, 0.75, 0.75]);
  assert.throws(() => zoom(p, 0), RangeError);
  const orb = speciesById('orbium');
  assert.equal(speciesRule(orb, 2).R, 26);
  assert.equal(speciesPattern(orb, 2).width, 40);
  assert.equal(fitScale(orb, 256), 3);
  assert.equal(fitScale(orb, 64), 1);
});

// Runs a species alone and returns its mass ratio range, path and net travel in units of R.
function run(s, steps, n = 128) {
  const w = new World(n, speciesRule(s));
  const p = speciesPattern(s);
  w.place(p, (n - p.width) >> 1, (n - p.height) >> 1);
  const m0 = w.mass();
  let c = w.centroid();
  let path = 0, nx = 0, ny = 0, lo = Infinity, hi = 0;
  for (let i = 1; i <= steps; i++) {
    w.step();
    if (i % 10 === 0) {
      const m = w.mass() / m0;
      lo = Math.min(lo, m);
      hi = Math.max(hi, m);
      const c2 = w.centroid();
      if (!c2) break;
      const d = torusDelta(c, c2, n);
      path += Math.hypot(d.dx, d.dy);
      nx += d.dx;
      ny += d.dy;
      c = c2;
    }
  }
  const R = s.rule.R;
  return { lo, hi, path: path / R, net: Math.hypot(nx, ny) / R };
}

for (const s of SPECIES) {
  test(`${s.id} survives and ${s.motion}`, () => {
    const r = run(s, s.motion === 'circles' ? 1000 : 500);
    assert.ok(r.lo > 0.85 && r.hi < 1.15, `mass ratio ${r.lo.toFixed(2)}-${r.hi.toFixed(2)}`);
    if (s.motion === 'glides') {
      assert.ok(r.net > 2, `net ${r.net.toFixed(2)} R`);
      assert.ok(r.net > 0.95 * r.path, `net ${r.net.toFixed(2)} of path ${r.path.toFixed(2)} R`);
    } else if (s.motion === 'circles') {
      assert.ok(r.path > 10, `path ${r.path.toFixed(2)} R`);
      assert.ok(r.net < 0.2 * r.path, `net ${r.net.toFixed(2)} of path ${r.path.toFixed(2)} R`);
    } else {
      assert.ok(r.path < 0.5, `path ${r.path.toFixed(2)} R`);
    }
  });
}
