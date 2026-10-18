import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voice, BASE_HZ } from '../src/audio.js';

test('an image is voiced at the base pitch times its ratio', () => {
  assert.equal(voice({ ratio: 1.5, dist: 30 }).hz, BASE_HZ * 1.5);
  assert.equal(voice({ ratio: -1.5, dist: 30 }).hz, BASE_HZ * 1.5);
});

test('pitch stays in an audible band near Mach 1', () => {
  assert.equal(voice({ ratio: 1e6, dist: 30 }).hz, 4000);
  assert.equal(voice({ ratio: 1e-6, dist: 30 }).hz, 40);
});

test('loudness falls with distance and with very high pitch', () => {
  const near = voice({ ratio: 1, dist: 20 }).gain;
  const far = voice({ ratio: 1, dist: 320 }).gain;
  assert.ok(Math.abs(near / far - 4) < 1e-9);
  assert.ok(voice({ ratio: 8, dist: 20 }).gain < near);
  assert.ok(voice({ ratio: 1, dist: 0 }).gain <= 0.25);
});
