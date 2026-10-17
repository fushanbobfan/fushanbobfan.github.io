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

test('tracer settings round-trip and shrink the room for other disks', () => {
  const s = { ...DEFAULTS, tracer: true, tracerMass: 60, tracerRadius: 8 };
  const q = encodeSettings(s);
  assert.equal(q, 'tracer=1&tracerMass=60&tracerRadius=8');
  assert.deepEqual(decodeSettings(q), s);
  assert.ok(capacity(1.2, 100, 100, 8) < capacity(1.2));
  const packed = clampSettings({ n: 1500, radius: 3, tracer: '1', tracerRadius: 12 });
  assert.equal(packed.n, capacity(3, 100, 100, 12));
});

test('the capacity with a tracer really fits', async () => {
  const { createGas } = await import('../src/gas.js');
  for (const [r, R] of [[1.2, 5], [2, 12], [0.4, 1], [3, 7]]) {
    const n = capacity(r, 100, 100, R);
    assert.doesNotThrow(() => createGas({ n, radius: r, tracer: { radius: R, mass: 10 } }));
    assert.throws(() => createGas({ n: n + 1, radius: r, tracer: { radius: R, mass: 10 } }), RangeError);
  }
});
