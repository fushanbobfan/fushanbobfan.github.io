import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, encodeSettings, decodeSettings, clampSettings, capacity } from '../src/settings.js';

test('defaults encode to an empty link', () => {
  assert.equal(encodeSettings(DEFAULTS), '');
  assert.deepEqual(decodeSettings(''), { ...DEFAULTS });
});

test('changed values round-trip through the link', () => {
  const s = { ...DEFAULTS, n: 250, kT: 2.5, start: 'hotcold', colour: 'half', trace: false, seed: 77 };
  const q = encodeSettings(s);
  assert.equal(q, 'n=250&kT=2.5&start=hotcold&seed=77&colour=half&trace=0');
  assert.deepEqual(decodeSettings('#' + q), s);
});

test('out-of-range and unknown values fall back or clamp', () => {
  const s = decodeSettings('?n=-5&kT=99&start=lava&colour=neon&rate=abc');
  assert.equal(s.n, 2);
  assert.equal(s.kT, 5);
  assert.equal(s.start, DEFAULTS.start);
  assert.equal(s.colour, DEFAULTS.colour);
  assert.equal(s.rate, DEFAULTS.rate);
});

test('the disk count never exceeds what the box can hold', () => {
  const s = clampSettings({ n: 1500, radius: 3 });
  assert.equal(s.n, capacity(3));
  assert.equal(capacity(3), 256);
});
