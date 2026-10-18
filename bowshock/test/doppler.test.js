import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machAngle, dopplerRatio, approaching, receding } from '../src/doppler.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('the Mach angle is undefined below Mach 1 and 30 degrees at Mach 2', () => {
  assert.equal(machAngle(0.8), null);
  assert.equal(machAngle(1), null);
  close(machAngle(2), Math.PI / 6);
  close(Math.sin(machAngle(1.4)), 1 / 1.4);
});

test('straight ahead and straight behind give the textbook shifts', () => {
  const c = 25;
  close(dopplerRatio(10, 0, 1, 0, c), approaching(0.4));
  close(dopplerRatio(10, 0, -1, 0, c), receding(0.4));
  close(approaching(0.5), 2);
  close(receding(1), 0.5);
});

test('sound sent at right angles to the motion is not shifted', () => {
  close(dopplerRatio(10, 0, 0, 1, 25), 1);
});

test('ahead of a supersonic source the ratio turns negative', () => {
  assert.ok(dopplerRatio(50, 0, 1, 0, 25) < 0);
  assert.ok(dopplerRatio(50, 0, -1, 0, 25) > 0);
});
