import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleAt, landscape, landscapeSlices, peak } from '../src/landscape.js';
import { GOLDEN_DEG, LUCAS_DEG, florets, packing } from '../src/phyllo.js';

test('samples run from one end of the window to the other', () => {
  assert.equal(angleAt(0, 135, 140, 501), 135);
  assert.equal(angleAt(500, 135, 140, 501), 140);
  assert.ok(Math.abs(angleAt(250, 135, 140, 501) - 137.5) < 1e-12);
});

test('filling the window a slice at a time gives the same values as one pass', () => {
  const whole = landscape(200, 136, 139, 31);
  let last;
  const seen = [];
  for (const part of landscapeSlices(200, 136, 139, 31, 7)) {
    seen.push(part.done);
    last = part.values;
  }
  assert.deepEqual(seen, [7, 14, 21, 28, 31]);
  assert.deepEqual([...last], [...whole]);
  assert.equal(whole[10], packing(florets(200, 137 / 360)));
});

test('between 135 and 140 degrees the best packing is at the golden angle', () => {
  const values = landscape(500, 135, 140, 501);
  const p = peak(values, 135, 140);
  assert.ok(Math.abs(p.deg - GOLDEN_DEG) <= 0.01, `peak at ${p.deg}`);
  assert.ok(p.value > 0.85);
});

test('the golden peak is a few hundredths of a degree wide', () => {
  const at = (d) => packing(florets(500, d / 360));
  const top = at(GOLDEN_DEG);
  for (const off of [-0.05, 0.05]) assert.ok(top - at(GOLDEN_DEG + off) > 0.1, `${off}`);
});

test('between 97 and 102 degrees the best packing is at the Lucas angle', () => {
  const values = landscape(500, 97, 102, 501);
  const p = peak(values, 97, 102);
  assert.ok(Math.abs(p.deg - LUCAS_DEG) <= 0.01, `peak at ${p.deg}`);
});
