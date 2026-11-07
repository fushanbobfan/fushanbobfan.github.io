import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftDown } from '../src/trackView.js';

test('shifting moves each row down one and keeps the width', () => {
  const width = 2;
  const height = 3;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    for (let at = 0; at < width * 4; at++) pixels[row * width * 4 + at] = row + 1;
  }
  shiftDown(pixels, width, height);
  assert.deepEqual([...pixels.slice(0, 8)], Array(8).fill(1), 'top row is left to rewrite');
  assert.deepEqual([...pixels.slice(8, 16)], Array(8).fill(1));
  assert.deepEqual([...pixels.slice(16, 24)], Array(8).fill(2), 'the oldest row falls off');
});
