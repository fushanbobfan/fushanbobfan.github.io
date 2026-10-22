import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, pictureRgba, cellsRgba } from '../src/render.js';
import { createField } from '../src/density.js';

test('hex colours parse with or without the hash', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.deepEqual(hexToRgb('0a0b0c'), [10, 11, 12]);
  assert.throws(() => hexToRgb('#fff'));
});

test('the picture runs from paper at zero to ink at full density', () => {
  const f = createField(3, 1, new Float32Array([0, 0.5, 1]));
  const px = pictureRgba(f, '#000000', '#ffffff');
  assert.deepEqual([...px], [255, 255, 255, 255, 128, 128, 128, 255, 0, 0, 0, 255]);
});

test('cell borders appear only where neighbouring labels differ', () => {
  const f = createField(4, 2);
  const labels = new Int32Array([0, 0, 1, 1, 0, 0, 1, 1]);
  const px = cellsRgba(labels, f, '#000000', '#ffffff');
  const red = (i) => px[4 * i];
  // Pixel 1 has a different right neighbour; pixel 0 and pixel 3 do not.
  assert.ok(red(1) < 200);
  assert.ok(red(5) < 200);
  assert.equal(red(0), 255);
  assert.equal(red(3), 255);
});
