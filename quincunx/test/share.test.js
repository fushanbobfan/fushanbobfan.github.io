import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, decode, encode, normalise } from '../src/share.js';

test('the defaults encode to an empty hash and decode back', () => {
  assert.equal(encode(DEFAULTS), '');
  assert.deepEqual(decode(''), { ...DEFAULTS });
});

test('settings survive a round trip through the link', () => {
  const s = { rows: 30, p: 0.37, seed: 4000000000, exact: false, normal: true };
  assert.deepEqual(decode(`#${encode(s)}`), s);
});

test('broken or hostile values fall back or get clamped', () => {
  const s = decode('#n=999&p=7&s=-4&e=%3Cscript%3E&g=yes');
  assert.equal(s.rows, 40);
  assert.equal(s.p, 1);
  assert.equal(s.seed, DEFAULTS.seed);
  assert.equal(s.exact, DEFAULTS.exact);
  assert.equal(s.normal, DEFAULTS.normal);
  assert.equal(decode('#n=abc&p=').rows, DEFAULTS.rows);
  assert.equal(decode('#p=').p, DEFAULTS.p);
  assert.equal(decode('#n=').rows, DEFAULTS.rows);
});

test('rows round to whole numbers and p to two decimals', () => {
  assert.equal(normalise({ rows: 7.6 }).rows, 8);
  assert.equal(normalise({ rows: 0 }).rows, 1);
  assert.equal(normalise({ p: 0.333 }).p, 0.33);
});
