import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAir } from '../src/air.js';
import { shineStart } from '../src/rays.js';
import { viewRows, describeView } from '../src/view.js';
import { nextDistance, copyVanishes, NEAREST } from '../src/drive.js';

test('the car closes in at 90 km/h and stops at the nearest position', () => {
  assert.equal(nextDistance(300, 1), 275);
  assert.equal(nextDistance(300, 0.04), 299);
  assert.equal(nextDistance(60, 1), NEAREST);
});

test('the upside-down copy vanishes near where the shine starts', () => {
  const air = makeAir({ surface: 55, air: 30, layer: 0.1 });
  const d = copyVanishes(air, 1.2);
  const shine = shineStart(air, 1.2);
  assert.ok(Math.abs(d - shine) < 0.25 * shine, `${d} vs ${shine}`);
  const copies = (distance) => describeView(viewRows(air, { eye: 1.2, distance }, 80)).invertedRows;
  assert.ok(copies(d + 20) > 0);
  assert.equal(copies(d - 20), 0);
});

test('no heating, no copy at any distance; a low eye keeps one up close', () => {
  assert.equal(copyVanishes(makeAir({ surface: 30, air: 30 }), 1.2), null);
  const crouch = copyVanishes(makeAir({ surface: 75, air: 20, layer: 0.05 }), 0.3);
  assert.ok(crouch < 100, crouch);
});
