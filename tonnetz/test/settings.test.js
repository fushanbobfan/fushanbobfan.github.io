import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, encode, decode, normalise, heldToText, heldFromText } from '../src/settings.js';

test('defaults encode to an empty query', () => {
  assert.equal(encode(DEFAULTS), '');
  assert.deepEqual(decode(''), DEFAULTS);
});

test('changed values round-trip through the query string', () => {
  const s = { ...DEFAULTS, progression: 'Am G F E', tempo: 120, spelling: 'sharps', labels: 'notes', chord: 'F#m' };
  const q = encode(s);
  assert.ok(q.includes('t=120'));
  assert.deepEqual(decode('?' + q), s);
  assert.deepEqual(decode('#' + q), s);
});

test('out-of-range and unknown values fall back safely', () => {
  const s = decode('t=999&s=weird&l=all&c=H7');
  assert.equal(s.tempo, 200);
  assert.equal(s.spelling, 'auto');
  assert.equal(s.labels, 'both');
  assert.equal(s.chord, 'C');
  assert.equal(decode('t=abc').tempo, DEFAULTS.tempo);
  assert.equal(normalise({ tempo: 5 }).tempo, 30);
});

test('long progressions are cut and chords are normalised', () => {
  assert.equal(normalise({ progression: 'C '.repeat(500) }).progression.length, 400);
  assert.equal(normalise({ chord: 'a' }).chord, 'Am');
});

test('held notes keep their order, drop repeats and bad names, and round-trip', () => {
  assert.equal(normalise({ held: 'E c g E H b' }).held, 'E C G B');
  assert.deepEqual(heldFromText('E C G B'), [4, 0, 7, 11]);
  assert.equal(heldToText([10, 2, 5]), 'Bb D F');
  const s = { ...DEFAULTS, held: 'G B D F' };
  assert.deepEqual(decode(encode(s)), s);
  assert.equal(normalise({ held: 'C C# D D# E F F# G G# A A# B C' }).held.split(' ').length, 12);
});
