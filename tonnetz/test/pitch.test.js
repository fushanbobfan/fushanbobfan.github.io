import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mod12, pcName, parseNote, spellAbove, midiToFrequency, nearestMidi, intervalName } from '../src/pitch.js';

test('mod12 wraps negatives into 0..11', () => {
  assert.equal(mod12(-1), 11);
  assert.equal(mod12(-13), 11);
  assert.equal(mod12(25), 1);
});

test('pitch class names follow the chosen spelling', () => {
  assert.equal(pcName(1, 'sharps'), 'C#');
  assert.equal(pcName(1, 'flats'), 'Db');
  assert.equal(pcName(6, 'auto'), 'F#');
  assert.equal(pcName(10, 'auto'), 'Bb');
  assert.equal(pcName(-2), 'Bb');
});

test('note names parse with ASCII and Unicode accidentals', () => {
  assert.deepEqual(parseNote('c'), { letter: 'C', accidental: 0, pc: 0 });
  assert.equal(parseNote('F#').pc, 6);
  assert.equal(parseNote('E♭').pc, 3);
  assert.equal(parseNote('Cb').pc, 11);
  assert.equal(parseNote('B#').pc, 0);
  assert.equal(parseNote('Fx').pc, 7);
  assert.equal(parseNote('H'), null);
  assert.equal(parseNote('Cbbb'), null);
});

test('notes above a root keep their letter and take the needed accidental', () => {
  assert.equal(spellAbove('F', 2, 9).name, 'A');
  assert.equal(spellAbove('F', 2, 10).name, 'A#');
  assert.equal(spellAbove('E', 2, 7).name, 'G');
  assert.equal(spellAbove('E', 4, 10).name, 'Bb');
  assert.equal(spellAbove('G', 2, 10).name, 'Bb');
  assert.equal(spellAbove('D', 2, 6).name, 'F#');
  assert.equal(spellAbove('A', 4, 4).name, 'E');
  assert.equal(spellAbove('E', 2, 8).name, 'G#');
  assert.equal(spellAbove('C', 4, 6).name, 'Gb');
});

test('A4 is 440 Hz and octaves double', () => {
  assert.equal(midiToFrequency(69), 440);
  assert.equal(midiToFrequency(81), 880);
  assert.ok(Math.abs(midiToFrequency(60) - 261.6256) < 1e-3);
});

test('nearest MIDI note picks the closest octave, ties downward', () => {
  assert.equal(nearestMidi(0, 61), 60);
  assert.equal(nearestMidi(11, 60), 59);
  assert.equal(nearestMidi(5, 62), 65);
  assert.equal(nearestMidi(6, 60), 54);
});

test('intervals are named by their size in semitones', () => {
  assert.equal(intervalName(7), 'perfect fifth');
  assert.equal(intervalName(-3), 'major sixth');
  assert.equal(intervalName(16), 'major third');
});
