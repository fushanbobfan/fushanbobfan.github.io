import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid } from '../src/hexgrid.js';
import { createModel, step } from '../src/reiter.js';
import {
  ramp, pack, unpack, cellColors, MODES,
} from '../src/palette.js';

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test('ramp hits its stops, interpolates between them and clamps outside', () => {
  const stops = [[0, [0, 0, 0]], [0.5, [100, 200, 50]], [1, [200, 200, 250]]];
  assert.deepEqual(ramp(stops, 0), [0, 0, 0]);
  assert.deepEqual(ramp(stops, 0.5), [100, 200, 50]);
  assert.deepEqual(ramp(stops, 0.25), [50, 100, 25]);
  assert.deepEqual(ramp(stops, 7), [200, 200, 250]);
  assert.deepEqual(ramp(stops, -1), [0, 0, 0]);
  assert.deepEqual(ramp(stops, NaN), [0, 0, 0]);
});

test('packing puts red in the low byte and round-trips', () => {
  assert.equal(pack([1, 2, 3]), 0xff030201);
  assert.deepEqual(unpack(pack([12, 200, 99], 128)), [12, 200, 99, 128]);
});

test('in every mode ice is brighter than the air around it', () => {
  const g = makeGrid(30);
  const m = step(createModel(g, { beta: 0.4, gamma: 0.002 }), 400);
  for (const mode of Object.keys(MODES)) {
    const colors = cellColors(m, mode);
    let darkestIce = Infinity;
    let brightestAir = 0;
    for (let c = 0; c < g.count; c++) {
      const l = lum(unpack(colors[c]));
      if (m.ice[c]) darkestIce = Math.min(darkestIce, l);
      else brightestAir = Math.max(brightestAir, l);
      assert.equal(unpack(colors[c])[3], 255);
    }
    if (mode !== 'vapour') assert.ok(darkestIce > brightestAir, `${mode}: ${darkestIce} vs ${brightestAir}`);
    else assert.ok(darkestIce >= brightestAir, mode);
  }
});

test('growth rings run from the dark centre to the bright newest ice', () => {
  const g = makeGrid(30);
  const m = step(createModel(g, { beta: 0.4, gamma: 0.002 }), 400);
  const colors = cellColors(m, 'growth');
  let newest = g.center;
  for (let c = 0; c < g.count; c++) if (m.frozenAt[c] > m.frozenAt[newest]) newest = c;
  assert.ok(lum(unpack(colors[newest])) > lum(unpack(colors[g.center])) + 100);
});
