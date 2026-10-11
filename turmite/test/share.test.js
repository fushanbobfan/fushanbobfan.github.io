import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, DEFAULTS, MAX_ANTS, MAX_STEPS, SPEEDS } from '../src/share.js';
import { LAYOUTS, toggleAnt } from '../src/ants.js';

test('state survives a round trip through the hash', () => {
  const s = { lattice: 'square', rule: 'LLRR', ants: [{ x: -3, y: 4, dir: 1 }, { x: 7, y: 0, dir: 3 }], steps: 12345, speed: 9 };
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
  assert.deepEqual(LAYOUTS.line(3, 'square', 6), [{ x: -6, y: 0, dir: 0 }, { x: 0, y: 0, dir: 0 }, { x: 6, y: 0, dir: 0 }]);
  const ring = LAYOUTS.ring(4, 'square', 10);
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
  const full = LAYOUTS.line(MAX_ANTS, 'square', 1);
  assert.equal(toggleAnt(full, 500, 500), full, 'no more than the limit');
});

test('the lattice travels in the link with its own default rule', () => {
  const hex = { lattice: 'hex', rule: 'L1R1', ants: [{ x: 0, y: 0, dir: 0 }], steps: 0, speed: 4 };
  assert.equal(encodeState(hex), 'g=hex');
  assert.deepEqual(decodeState('g=hex'), hex);
  const s = { ...hex, rule: 'L1L2NUL2L1R2', ants: [{ x: 1, y: 2, dir: 5 }], steps: 9 };
  assert.deepEqual(decodeState(encodeState(s)), s);
  assert.equal(decodeState('g=hex&r=RL').rule, 'L1R1', 'square letters are not a hex rule');
  assert.equal(decodeState('g=cube').lattice, 'square');
  assert.equal(decodeState('g=hex&a=0,0,7').ants[0].dir, 1, 'directions wrap at six');
  assert.equal(decodeState('a=0,0,7').ants[0].dir, 3, 'and at four on squares');
});

test('hexagonal layouts use six directions and never stack ants', () => {
  assert.deepEqual(LAYOUTS.pair(2, 'hex'), [{ x: 0, y: 0, dir: 5 }, { x: 1, y: 0, dir: 2 }]);
  assert.ok(LAYOUTS.line(4, 'hex').every((a) => a.dir === 5 && a.y === 0));
  const ring = LAYOUTS.ring(6, 'hex', 10);
  // Heading clockwise: the top ant faces east, the bottom one west.
  assert.deepEqual(ring[0], { x: 6, y: -12, dir: 0 }, 'straight above the origin');
  assert.equal(ring[3].dir, 3);
  for (const n of [2, 5, 8, 16]) {
    const cells = new Set(LAYOUTS.ring(n, 'hex').map((a) => `${a.x},${a.y}`));
    assert.equal(cells.size, n);
  }
});

test('on hexagons a click turns an ant through six directions before removing it', () => {
  let ants = toggleAnt([], 0, 0, 6);
  for (let d = 1; d <= 5; d++) ants = toggleAnt(ants, 0, 0, 6);
  assert.equal(ants[0].dir, 5);
  assert.deepEqual(toggleAnt(ants, 0, 0, 6), []);
});
