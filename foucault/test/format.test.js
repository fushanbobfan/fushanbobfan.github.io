import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration, hours, latitude } from '../src/format.js';

test('durations pick a unit and round within it', () => {
  assert.equal(duration(16.42), '16 s');
  assert.equal(duration(4.25), '4.3 s');
  assert.equal(duration(119.6), '2 min');
  assert.equal(duration(200), '3 min 20 s');
  assert.equal(duration(31.8 * 3600), '31 h 48 min');
  assert.equal(duration(3599.8 + 3600), '2 h');
  assert.equal(duration(5 * 86400), '5.0 days');
  assert.equal(duration(Infinity), 'never');
});

test('hours and latitudes', () => {
  assert.equal(hours(86164.09), '23.9 h');
  assert.equal(hours(3 * 3600), '3.00 h');
  assert.equal(latitude(48.8462), '48.8° N');
  assert.equal(latitude(-33.87), '33.9° S');
  assert.equal(latitude(0.01), '0°');
});
