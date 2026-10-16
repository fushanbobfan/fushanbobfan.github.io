import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHORD_TYPES, normaliseSet, nameSet, describeSet, parseNotes, toggle } from '../src/chordset.js';

const symbols = (pcs, opts) => nameSet(pcs, opts).map((n) => n.symbol);

test('chord types have distinct interval sets', () => {
  const keys = new Set(CHORD_TYPES.map((t) => t.intervals.join()));
  assert.equal(keys.size, CHORD_TYPES.length);
  for (const t of CHORD_TYPES) assert.equal(t.intervals[0], 0);
});

test('sets are reduced to sorted distinct pitch classes', () => {
  assert.deepEqual(normaliseSet([16, 7, 4, 12]), [0, 4, 7]);
});

test('triads of every quality are named', () => {
  assert.deepEqual(symbols([0, 4, 7]), ['C']);
  assert.deepEqual(symbols([9, 0, 4]), ['Am']);
  assert.deepEqual(symbols([11, 2, 5]), ['Bdim']);
  assert.deepEqual(symbols([2, 7, 9]), ['Dsus4', 'Gsus2']);
});

test('seventh chords are named', () => {
  assert.deepEqual(symbols([0, 4, 7, 11]), ['Cmaj7']);
  assert.deepEqual(symbols([7, 11, 2, 5]), ['G7']);
  assert.deepEqual(symbols([2, 5, 9, 0]), ['Dm7']);
  assert.deepEqual(symbols([11, 2, 5, 9]), ['Bm7b5']);
  assert.deepEqual(symbols([0, 3, 7, 11]), ['Cm(maj7)']);
});

test('symmetric chords give every root and the bass comes first', () => {
  assert.deepEqual(symbols([0, 4, 8]), ['Caug', 'Eaug', 'Abaug']);
  assert.equal(nameSet([0, 3, 6, 9]).length, 4);
  assert.deepEqual(symbols([0, 4, 8], { bass: 8 })[0], 'Abaug');
  assert.deepEqual(symbols([2, 7, 9], { bass: 7 }), ['Gsus2', 'Dsus4']);
});

test('descriptions cover empty sets, single notes, intervals and unnamed sets', () => {
  assert.equal(describeSet([]), 'No notes held');
  assert.equal(describeSet([10]), 'Bb');
  assert.equal(describeSet([0, 7]), 'G–C: perfect fourth');
  assert.equal(describeSet([0, 7], { bass: 0 }), 'C–G: perfect fifth');
  assert.equal(describeSet([0, 4], { bass: 4 }), 'E–C: minor sixth');
  assert.equal(describeSet([11, 0]), 'B–C: minor second');
  assert.equal(describeSet([0, 6]), 'C–F#: tritone');
  assert.equal(describeSet([0, 1, 2]), 'C Db D');
  assert.equal(describeSet([0, 4, 8], { spelling: 'sharps' }), 'Caug = Eaug = G#aug');
});

test('note lists parse and report bad tokens', () => {
  assert.deepEqual(parseNotes('C E G Bb'), { pcs: [0, 4, 7, 10], errors: [] });
  assert.deepEqual(parseNotes('c,e♭, g  H'), { pcs: [0, 3, 7], errors: ['H'] });
});

test('toggling adds and removes a pitch class', () => {
  assert.deepEqual(toggle([0, 4], 7), [0, 4, 7]);
  assert.deepEqual(toggle([0, 4, 7], 16), [0, 7]);
});
