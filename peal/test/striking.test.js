import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blowTime, blowAt, intervalForPealSpeed, bellFrequency, semitonesBelowTreble, PARTIALS,
} from '../src/striking.js';

test('a handstroke row opens with a one-blow gap, a backstroke follows on at once', () => {
  assert.equal(blowTime(0, 0, 6, 1), 1);
  assert.equal(blowTime(0, 5, 6, 1), 6);
  assert.equal(blowTime(1, 0, 6, 1), 7);
  assert.equal(blowTime(1, 5, 6, 1), 12);
  assert.equal(blowTime(2, 0, 6, 1), 14, 'gap before the next handstroke');
});

test('a whole pull, handstroke and backstroke, is 2n + 1 blows', () => {
  for (const n of [5, 6, 8]) {
    assert.equal(blowTime(2, 0, n, 1) - blowTime(0, 0, n, 1), 2 * n + 1);
    assert.equal(blowTime(2, 0, n, 1, 0) - blowTime(0, 0, n, 1, 0), 2 * n);
  }
});

test('blowAt finds the blow sounding at a time', () => {
  for (const n of [5, 8]) {
    for (let row = 0; row < 6; row++) {
      for (let place = 0; place < n; place++) {
        const t = blowTime(row, place, n, 0.25) + 0.1;
        assert.deepEqual(blowAt(t, n, 0.25), { row, place, inGap: false });
      }
    }
  }
  assert.deepEqual(blowAt(0.1, 6, 1), { row: 0, place: 0, inGap: true });
  assert.deepEqual(blowAt(13.5, 6, 1), { row: 2, place: 0, inGap: true });
});

test('a three-hour peal on eight bells strikes about four blows a second', () => {
  const interval = intervalForPealSpeed(3, 8);
  assert.ok(Math.abs(interval - 10800 / 42840) < 1e-12);
  assert.ok(interval > 0.24 && interval < 0.26);
});

test('the bells form a descending major scale from the treble', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(semitonesBelowTreble), [0, 1, 3, 5, 7, 8, 10, 12]);
  assert.ok(Math.abs(bellFrequency(8, 880) - 440) < 1e-9, 'the tenor of eight is an octave below the treble');
  for (let b = 2; b <= 12; b++) assert.ok(bellFrequency(b) < bellFrequency(b - 1));
});

test('bell partials: hum and prime are octaves below the nominal, the tierce a minor third above the prime', () => {
  const r = Object.fromEntries(PARTIALS.map((p) => [p.name, p.ratio]));
  assert.equal(r.nominal, 1);
  assert.equal(r.prime, 0.5);
  assert.equal(r.hum, 0.25);
  assert.ok(Math.abs(r.tierce / r.prime - 1.2) < 1e-12);
  for (let i = 1; i < PARTIALS.length; i++) assert.ok(PARTIALS[i].decay <= PARTIALS[i - 1].decay);
});
