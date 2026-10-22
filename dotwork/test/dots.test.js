import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dotRadii, coverage, evenRadiusFor } from '../src/dots.js';
import { seedPoints, relax } from '../src/lloyd.js';
import { drawSource } from '../src/sources.js';
import { fieldMean } from '../src/density.js';
import { createRng } from '../src/rng.js';

test('even dots all share one radius', () => {
  const r = dotRadii({ mass: new Float64Array([1, 9, 0]) }, 3, { mode: 'even', radius: 1.5 });
  assert.deepEqual([...r], [1.5, 1.5, 1.5]);
});

test('tone dots grow with the square root of their ink and respect the minimum', () => {
  const r = dotRadii({ mass: new Float64Array([Math.PI, 4 * Math.PI, 0]) }, 3, { mode: 'tone', min: 0.3 });
  assert.ok(Math.abs(r[0] - 1) < 1e-12);
  assert.ok(Math.abs(r[1] - 2) < 1e-12);
  assert.equal(r[2], 0.3);
});

test('tone dots ink the same share of the page as the picture', () => {
  const f = drawSource('sphere', 120, 90);
  const count = 900;
  const p = seedPoints(f, count, createRng(6));
  const scratch = {};
  let step;
  for (let k = 0; k < 8; k++) step = relax(f, p, count, scratch);
  const r = dotRadii(step.stats, count, { mode: 'tone' });
  assert.ok(Math.abs(coverage(r, count, 120, 90) - fieldMean(f)) < 1e-9);
});

test('the even starting radius inks the mean density', () => {
  const r = evenRadiusFor(0.4, 500, 200, 100);
  const radii = new Float64Array(500).fill(r);
  assert.ok(Math.abs(coverage(radii, 500, 200, 100) - 0.4) < 1e-12);
  assert.equal(evenRadiusFor(0.4, 0, 10, 10), 0);
});
