import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dotColours, toHex, colourGroups } from '../src/colour.js';
import { createField } from '../src/density.js';
import { paintSource } from '../src/sources.js';
import { seedPoints, relax } from '../src/lloyd.js';
import { createRng } from '../src/rng.js';

test('a dot takes the ink-weighted mean colour of its cell', () => {
  // Two pixels in one cell: dark red with weight 0.9, pale blue with weight 0.1.
  const field = createField(2, 1, new Float32Array([0.9, 0.1]));
  const colour = { width: 2, height: 1, rgb: new Uint8ClampedArray([200, 0, 0, 0, 0, 250]) };
  const rgb = dotColours(new Int32Array([0, 0]), field, colour, new Float64Array([1, 0.5]), 1);
  assert.deepEqual([...rgb], [180, 0, 25]);
});

test('a dot with no ink in its cell takes the pixel beneath it', () => {
  const field = createField(2, 1, new Float32Array([0, 0]));
  const colour = { width: 2, height: 1, rgb: new Uint8ClampedArray([1, 2, 3, 4, 5, 6]) };
  const rgb = dotColours(new Int32Array([0, -1]), field, colour, new Float64Array([1.7, 0.2]), 1);
  assert.deepEqual([...rgb], [4, 5, 6]);
});

test('dots on the colour wheel pick up the hue around them', () => {
  const { field, colour } = paintSource('wheel', 120, 120);
  const count = 600;
  const p = seedPoints(field, count, createRng(5));
  const scratch = {};
  for (let k = 0; k < 5; k++) relax(field, p, count, scratch);
  const rgb = dotColours(scratch.labels, field, colour, p, count);
  let checked = 0;
  for (let i = 0; i < count; i++) {
    const u = (p[2 * i] - 60) / 60;
    const v = (p[2 * i + 1] - 60) / 60;
    if (Math.hypot(u, v) < 0.7 || Math.hypot(u, v) > 0.85 || Math.abs(v) > 0.1 || u < 0) continue;
    // Right of centre is red.
    assert.ok(rgb[3 * i] > rgb[3 * i + 1] + 80 && rgb[3 * i] > rgb[3 * i + 2] + 80, `dot ${i}`);
    checked++;
  }
  assert.ok(checked >= 2);
});

test('hex strings are two digits per channel', () => {
  assert.equal(toHex(0, 15.6, 255), '#0010ff');
});

test('grouping rounds colours and keeps every dot once', () => {
  const rgb = new Uint8ClampedArray([10, 10, 10, 12, 9, 14, 200, 0, 0]);
  const groups = colourGroups(rgb, 3, 4);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.flatMap((g) => g.dots).sort(), [0, 1, 2]);
  assert.equal(groups[0].colour, '#080808');
});
