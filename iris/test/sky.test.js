import { test } from 'node:test';
import assert from 'node:assert/strict';
import { antisolarAngle, bowTop, bowSpan } from '../src/sky.js';

const R = Math.PI / 180;

test('the antisolar point is as far below the horizon as the sun is above', () => {
  for (const h of [0, 10, 35]) {
    assert.ok(antisolarAngle(0, -h * R, h * R) < 1e-7);
    assert.ok(Math.abs(antisolarAngle(0, 0, h * R) - h * R) < 1e-12);
  }
});

test('straight up is 90° plus the sun\'s elevation from the antisolar point', () => {
  assert.ok(Math.abs(antisolarAngle(0, Math.PI / 2, 20 * R) - 110 * R) < 1e-12);
});

test('the top of the bow and its foot on the horizon lie on the bow', () => {
  const alpha = 42 * R;
  for (const h of [0, 15, 30]) {
    const top = bowTop(alpha, h * R);
    assert.ok(Math.abs(antisolarAngle(0, top, h * R) - alpha) < 1e-12);
    const span = bowSpan(alpha, h * R);
    assert.ok(Math.abs(antisolarAngle(span, 0, h * R) - alpha) < 1e-12);
  }
});

test('with the sun at 0° the bow is a half circle, and above 42° it is gone', () => {
  assert.ok(Math.abs(bowSpan(42 * R, 0) - 42 * R) < 1e-12);
  assert.equal(bowSpan(42 * R, 45 * R), 0);
  assert.ok(bowTop(42 * R, 45 * R) < 0);
});
