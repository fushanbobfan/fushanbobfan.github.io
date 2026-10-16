import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, encode, decode, normalise } from '../src/settings.js';

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
