import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, decode, encode, normalise } from '../src/share.js';

test('the defaults encode to an empty hash and decode back', () => {
  assert.equal(encode(DEFAULTS), '');
  assert.deepEqual(decode(''), { ...DEFAULTS });
});

test('settings survive a round trip through the link', () => {
  const s = { rows: 30, p: 0.37, seed: 4000000000, exact: false, normal: true, pattern: 'ramp', custom: [] };
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

test('painted rows round-trip for the hand-set pattern only', () => {
  const s = { ...DEFAULTS, rows: 4, pattern: 'hand', custom: [0.1, 0.95, 0, 1] };
  const hash = encode(s);
  assert.match(hash, /h=10\.95\.0\.100/);
  assert.deepEqual(decode(`#${hash}`).custom, [0.1, 0.95, 0, 1]);
  assert.deepEqual(normalise({ pattern: 'ramp', custom: [0.2] }).custom, []);
});

test('painted rows are clamped, trimmed to the board and gaps filled with p', () => {
  const s = decode('#n=3&p=0.4&t=hand&h=250.x..-20.70');
  assert.deepEqual(s.custom, [1, 0.4, 0.4]);
  assert.equal(decode('#t=sideways').pattern, 'same');
});
