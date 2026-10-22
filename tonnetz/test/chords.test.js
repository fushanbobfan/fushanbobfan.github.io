import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  triad, pitchClasses, triadIndex, triadFromIndex, ALL_TRIADS, chordName, chordLongName,
  spellTriad, parseChord, parseProgression, identifyTriad,
} from '../src/chords.js';

test('triads hold root, third and fifth', () => {
  assert.deepEqual(pitchClasses(triad(0, 'M')), [0, 4, 7]);
  assert.deepEqual(pitchClasses(triad(9, 'm')), [9, 0, 4]);
  assert.deepEqual(pitchClasses(triad(11, 'M')), [11, 3, 6]);
});

test('the 24 triads are distinct and indexable', () => {
  assert.equal(ALL_TRIADS.length, 24);
  const keys = new Set(ALL_TRIADS.map((t) => pitchClasses(t).slice().sort((a, b) => a - b).join()));
  assert.equal(keys.size, 24);
  for (let i = 0; i < 24; i++) assert.equal(triadIndex(triadFromIndex(i)), i);
});

test('chord names respect the spelling and any typed root', () => {
  assert.equal(chordName(triad(10, 'M')), 'Bb');
  assert.equal(chordName(triad(10, 'M'), 'sharps'), 'A#');
  assert.equal(chordName(triad(1, 'm'), 'sharps'), 'C#m');
  assert.equal(chordName(parseChord('A#')), 'A#');
  assert.equal(chordLongName(triad(8, 'm')), 'A-flat minor');
  assert.equal(chordLongName(parseChord('F#')), 'F-sharp major');
});

test('triads are spelled on consecutive letters', () => {
  assert.deepEqual(spellTriad(triad(8, 'M')), ['Ab', 'C', 'Eb']);
  assert.deepEqual(spellTriad(triad(6, 'M')), ['F#', 'A#', 'C#']);
  assert.deepEqual(spellTriad(triad(3, 'm')), ['Eb', 'Gb', 'Bb']);
  assert.deepEqual(spellTriad(triad(11, 'M')), ['B', 'D#', 'F#']);
  assert.deepEqual(spellTriad(parseChord('G#m')), ['G#', 'B', 'D#']);
  assert.deepEqual(spellTriad(parseChord('Cb')), ['Cb', 'Eb', 'Gb']);
});

test('chord symbols parse in the usual forms', () => {
  assert.deepEqual(parseChord('Am'), { root: 9, quality: 'm', name: 'A' });
  assert.equal(parseChord('F#').root, 6);
  assert.equal(parseChord('Bbmin').quality, 'm');
  assert.equal(parseChord('E♭m').root, 3);
  assert.equal(parseChord('Dmaj').quality, 'M');
  assert.equal(parseChord('a').quality, 'm');
  assert.equal(parseChord('C-').quality, 'm');
  assert.equal(parseChord('C7'), null);
  assert.equal(parseChord('X'), null);
});

test('progressions split on spaces, commas and bars and report bad tokens', () => {
  const p = parseProgression('C G | Am, F  Csus4');
  assert.deepEqual(p.chords.map((c) => chordName(c)), ['C', 'G', 'Am', 'F']);
  assert.deepEqual(p.errors, ['Csus4']);
  assert.deepEqual(parseProgression('C - Em - F').chords.length, 3);
  assert.deepEqual(parseProgression('   ').chords, []);
});

test('three pitch classes are recognised as a triad in any order or octave', () => {
  assert.deepEqual(identifyTriad([4, 7, 0]), triad(0, 'M'));
  assert.deepEqual(identifyTriad([16, 9, 12]), triad(9, 'm'));
  assert.equal(identifyTriad([0, 4, 8]), null);
  assert.equal(identifyTriad([0, 4]), null);
});
