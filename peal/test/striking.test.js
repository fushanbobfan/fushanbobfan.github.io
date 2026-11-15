import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blowTime, blowAt, intervalForPealSpeed, bellFrequency, semitonesAboveTenor, PARTIALS,
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

test('a ring is a major scale up from the tenor as keynote', () => {
  const up = (n) => Array.from({ length: n }, (_, i) => semitonesAboveTenor(n - i, n));
  assert.deepEqual(up(6), [0, 2, 4, 5, 7, 9], 'six bells: doh to lah');
  assert.deepEqual(up(8), [0, 2, 4, 5, 7, 9, 11, 12]);
  assert.deepEqual(up(5), [0, 2, 4, 5, 7]);
  assert.ok(Math.abs(bellFrequency(1, 8, 220) - 440) < 1e-9, 'the treble of eight is an octave above the tenor');
  for (const n of [5, 6, 8, 12]) {
    assert.equal(bellFrequency(n, n, 300), 300);
    for (let b = 2; b <= n; b++) assert.ok(bellFrequency(b, n) < bellFrequency(b - 1, n));
  }
});

test('bell partials: hum and prime are octaves below the nominal, the tierce a minor third above the prime', () => {
  const r = Object.fromEntries(PARTIALS.map((p) => [p.name, p.ratio]));
  assert.equal(r.nominal, 1);
  assert.equal(r.prime, 0.5);
  assert.equal(r.hum, 0.25);
  assert.ok(Math.abs(r.tierce / r.prime - 1.2) < 1e-12);
  for (let i = 1; i < PARTIALS.length; i++) assert.ok(PARTIALS[i].decay <= PARTIALS[i - 1].decay);
});
