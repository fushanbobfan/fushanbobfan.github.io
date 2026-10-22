import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, findPlace } from '../src/places.js';
import { attractingCycle } from '../src/cycle.js';
import { sample, SAMPLE_SIZE, ESCAPED } from '../src/dynamics.js';

test('each place has the attracting period its note claims', () => {
  for (const p of PLACES) {
    const cyc = attractingCycle(p.c[0], p.c[1], 100000);
    assert.equal(cyc ? cyc.period : null, p.period, p.name);
  }
});

test('places described as outside the set escape, the others do not', () => {
  const out = new Float64Array(SAMPLE_SIZE);
  for (const p of PLACES) {
    const escapes = sample(out, 0, 0, p.c[0], p.c[1], 100000, false)[ESCAPED] === 1;
    const saysOutside = /outside the set|escapes/.test(p.note);
    assert.equal(escapes, saysOutside, p.name);
  }
});

test('the Siegel parameter has a neutral fixed point at the golden-mean angle', () => {
  const [x, y] = findPlace('siegel').c;
  // fixed point z = (1 - sqrt(1 - 4c)) / 2, multiplier 2z
  const ar = 1 - 4 * x;
  const ai = -4 * y;
  const r = Math.hypot(ar, ai);
  const sr = Math.sqrt((r + ar) / 2);
  const si = Math.sign(ai) * Math.sqrt((r - ar) / 2);
  const lr = 1 - sr;
  const li = -si;
  assert.ok(Math.abs(Math.hypot(lr, li) - 1) < 1e-12);
  const angle = (Math.atan2(li, lr) / (2 * Math.PI) + 1) % 1;
  assert.ok(Math.abs(angle - (Math.sqrt(5) - 1) / 2) < 1e-12);
});

test('ids are unique and views are positive', () => {
  assert.equal(new Set(PLACES.map((p) => p.id)).size, PLACES.length);
  for (const p of PLACES) assert.ok(p.view[2] > 0, p.name);
  assert.equal(findPlace('nowhere'), null);
});
