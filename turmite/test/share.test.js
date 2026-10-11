import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, DEFAULTS, MAX_ANTS, MAX_STEPS, SPEEDS } from '../src/share.js';
import { LAYOUTS, toggleAnt } from '../src/ants.js';

test('state survives a round trip through the hash', () => {
  const s = { rule: 'LLRR', ants: [{ x: -3, y: 4, dir: 1 }, { x: 7, y: 0, dir: 3 }], steps: 12345, speed: 9 };
  assert.deepEqual(decodeState('#' + encodeState(s)), s);
});

test('defaults are left out of the link', () => {
  assert.equal(encodeState(DEFAULTS), '');
  assert.deepEqual(decodeState(''), DEFAULTS);
  assert.deepEqual(decodeState('a=').ants, [], 'an empty ant list is kept');
});

test('hostile or malformed values fall back or clamp', () => {
  const s = decodeState('r=RLX&a=1,2&s=-5&v=99');
  assert.equal(s.rule, 'RL');
  assert.deepEqual(s.ants, DEFAULTS.ants);
  assert.equal(s.steps, 0);
  assert.equal(s.speed, SPEEDS.length - 1);
  assert.equal(decodeState('s=1e9').steps, 0, 'not an integer');
  assert.equal(decodeState('s=999999999').steps, MAX_STEPS);
  assert.deepEqual(decodeState('a=5000,-5000,-1').ants, [{ x: 1000, y: -1000, dir: 3 }]);
  const many = Array.from({ length: 40 }, (_, i) => `${i},0,0`).join(';');
  assert.equal(decodeState('a=' + many).ants.length, MAX_ANTS);
});

test('layouts place ants where they say', () => {
  assert.deepEqual(LAYOUTS.line(3, 6), [{ x: -6, y: 0, dir: 0 }, { x: 0, y: 0, dir: 0 }, { x: 6, y: 0, dir: 0 }]);
  const ring = LAYOUTS.ring(4, 10);
  assert.deepEqual(ring, [
    { x: 0, y: -10, dir: 1 }, // top, heading right
    { x: 10, y: 0, dir: 2 }, // right, heading down
    { x: 0, y: 10, dir: 3 },
    { x: -10, y: 0, dir: 0 },
  ]);
  const keys = new Set(LAYOUTS.ring(8).map((a) => `${a.x},${a.y}`));
  assert.equal(keys.size, 8, 'no two ants on one cell');
});

test('clicking adds, turns and finally removes an ant', () => {
  let ants = [];
  ants = toggleAnt(ants, 2, 3);
  assert.deepEqual(ants, [{ x: 2, y: 3, dir: 0 }]);
  for (let d = 1; d <= 3; d++) {
    ants = toggleAnt(ants, 2, 3);
    assert.equal(ants[0].dir, d);
  }
  assert.deepEqual(toggleAnt(ants, 2, 3), []);
  const full = LAYOUTS.line(MAX_ANTS, 1);
  assert.equal(toggleAnt(full, 500, 500), full, 'no more than the limit');
});
