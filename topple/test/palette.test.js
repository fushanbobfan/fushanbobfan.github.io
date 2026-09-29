import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PALETTES, DEFAULT_PALETTE, hexToRgb, packRgba, paletteWords, luminance, contrast,
} from '../src/palette.js';

test('colours parse and pack into ImageData byte order', () => {
  assert.deepEqual(hexToRgb('#102030'), [16, 32, 48]);
  const w = packRgba([1, 2, 3]);
  const bytes = new Uint8Array(Uint32Array.of(w).buffer);
  assert.deepEqual([...bytes], [1, 2, 3, 255]);
  assert.throws(() => hexToRgb('red'));
});

test('every palette gives five words and unknown names fall back', () => {
  for (const name of Object.keys(PALETTES)) assert.equal(paletteWords(name).length, 5);
  assert.deepEqual([...paletteWords('nope')], [...paletteWords(DEFAULT_PALETTE)]);
});

test('heights run monotonically in brightness so the pile reads as a ramp', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    const l = p.colors.map(luminance);
    const up = l.every((v, i) => i === 0 || v > l[i - 1]);
    const down = l.every((v, i) => i === 0 || v < l[i - 1]);
    assert.ok(up || down, name);
  }
});

test('neighbouring heights are distinguishable', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    for (let i = 1; i < 4; i++) {
      assert.ok(contrast(p.colors[i], p.colors[i - 1]) >= 1.5, `${name} ${i}`);
    }
  }
});
