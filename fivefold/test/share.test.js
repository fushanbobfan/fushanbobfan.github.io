import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, MAX_GENERATIONS, MAX_OVERLAY, decode, encode, normalise } from '../src/share.js';

test('the defaults encode to an empty hash and decode back', () => {
  assert.equal(encode(DEFAULTS), '');
  assert.deepEqual(decode(''), DEFAULTS);
});

test('settings survive a round trip through the link', () => {
  const s = { seed: 'p3-star', generations: 8, fit: 'patch', zoom: 2.5, colouring: 'direction', palette: 'garden', weight: 0, overlay: 2, arcs: true };
  assert.deepEqual(decode(`#${encode(s)}`), s);
});

test('broken or hostile values fall back or get clamped', () => {
  const s = decode('#s=evil&g=999&f=zoomy&z=-3&c=%3Cscript%3E&p=nope&w=abc');
  assert.equal(s.seed, DEFAULTS.seed);
  assert.equal(s.generations, MAX_GENERATIONS);
  assert.equal(s.fit, DEFAULTS.fit);
  assert.equal(s.zoom, 1);
  assert.equal(s.colouring, DEFAULTS.colouring);
  assert.equal(s.palette, DEFAULTS.palette);
  assert.equal(s.weight, DEFAULTS.weight);
});

test('generations are whole numbers', () => {
  assert.equal(normalise({ generations: 4.6 }).generations, 5);
  assert.equal(normalise({ generations: -2 }).generations, 0);
});

test('the outline depth is a whole number of generations within range', () => {
  assert.equal(decode('#o=9').overlay, MAX_OVERLAY);
  assert.equal(decode('#o=1.4').overlay, 1);
  assert.equal(decode('#o=x').overlay, 0);
  assert.equal(encode({ overlay: 1 }), 'o=1');
});

test('arcs are switched on only by an explicit 1', () => {
  assert.equal(encode({ arcs: true }), 'a=1');
  assert.equal(decode('#a=1').arcs, true);
  assert.equal(decode('#a=yes').arcs, false);
  assert.equal(decode('#a=0').arcs, false);
});
