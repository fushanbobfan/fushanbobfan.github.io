import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPELLINGS } from '../src/pitch.js';
import { isBlack, keyboardLayout, midiLabel, BLACK_WIDTH } from '../src/keyboard.js';

test('black keys are the sharps and flats', () => {
  assert.deepEqual([60, 61, 62, 63, 64, 65, 66].map(isBlack), [false, true, false, true, false, false, true]);
  assert.equal(isBlack(-1), false);
});

test('three octaves from C3 hold 21 white and 15 black keys', () => {
  const { keys, width } = keyboardLayout(48, 83);
  assert.equal(keys.length, 36);
  assert.equal(width, 21);
  assert.equal(keys.filter((k) => k.black).length, 15);
  assert.equal(keys[0].midi, 48);
  assert.equal(keys[keys.length - 1].midi, 83);
});

test('white keys tile without gaps and black keys straddle them', () => {
  const { keys } = keyboardLayout(60, 71);
  const whites = keys.filter((k) => !k.black);
  whites.forEach((k, i) => assert.equal(k.x, i));
  const cs = keys.find((k) => k.midi === 61);
  assert.equal(cs.x, 1 - BLACK_WIDTH / 2);
  assert.equal(cs.w, BLACK_WIDTH);
});

test('ranges that start or end on a black key are widened to white keys', () => {
  const { keys } = keyboardLayout(61, 70);
  assert.equal(keys[0].midi, 60);
  assert.equal(keys[keys.length - 1].midi, 71);
});

test('labels carry the octave number', () => {
  assert.equal(midiLabel(60, SPELLINGS.auto), 'C4');
  assert.equal(midiLabel(58, SPELLINGS.auto), 'Bb3');
  assert.equal(midiLabel(69, SPELLINGS.sharps), 'A4');
});
