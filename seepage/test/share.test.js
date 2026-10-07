import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, decode, encode, normalise } from '../src/share.js';

test('the defaults encode to an empty hash and decode back', () => {
  assert.equal(encode(DEFAULTS), '');
  assert.deepEqual(decode(''), DEFAULTS);
});

test('settings survive a round trip through the link', () => {
  const s = { mode: 'bond', size: 256, p: 0.501, seed: 4000000000, colouring: 'size', palette: 'sea' };
  assert.deepEqual(decode(`#${encode(s)}`), s);
});

test('broken or hostile values fall back or get clamped', () => {
  const s = decode('#m=hex&n=99999&p=7&s=-4&c=%3Cscript%3E&k=__proto__');
  assert.equal(s.mode, DEFAULTS.mode);
  assert.equal(s.size, 512);
  assert.equal(s.p, 1);
  assert.equal(s.seed, DEFAULTS.seed);
  assert.equal(s.colouring, DEFAULTS.colouring);
  assert.equal(s.palette, DEFAULTS.palette);
});

test('sizes snap to the offered grid sizes and p to three decimals', () => {
  assert.equal(normalise({ size: 100 }).size, 128);
  assert.equal(normalise({ size: 1 }).size, 32);
  assert.equal(normalise({ p: 0.59274 }).p, 0.593);
  assert.equal(normalise({ p: 'abc' }).p, DEFAULTS.p);
});
