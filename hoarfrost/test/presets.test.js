import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, findPreset } from '../src/presets.js';
import { clampParam } from '../src/params.js';
import { makeGrid } from '../src/hexgrid.js';
import { createModel, step } from '../src/reiter.js';

function grow(params, radius = 40) {
  const m = createModel(makeGrid(radius), params);
  while (!m.done && m.step < 20000) step(m, 50);
  return m;
}

test('presets have unique ids, names, notes and in-range parameters', () => {
  const ids = PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PRESETS) {
    assert.ok(p.name && p.note, p.id);
    for (const [name, value] of Object.entries(p.params)) {
      assert.equal(clampParam(name, value), value, `${p.id}.${name}`);
    }
    assert.equal(findPreset(p.id), p);
  }
  assert.equal(findPreset('custom'), null);
});

test('every preset grows until it reaches the edge of the grid', () => {
  for (const p of PRESETS) assert.equal(grow(p.params).done, true, p.id);
});

test('the plate fills nearly all of its hexagon and the needles well under half of it', () => {
  const share = (id) => {
    const m = grow(findPreset(id).params);
    const g = m.grid;
    let inside = 0;
    for (let c = 0; c < g.count; c++) if (g.dist[c] <= m.extent) inside++;
    return m.iceCount / inside;
  };
  assert.ok(share('plate') > 0.95, `plate ${share('plate')}`);
  assert.ok(share('needles') < 0.5, `needles ${share('needles')}`);
});
