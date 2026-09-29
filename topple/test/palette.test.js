import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PALETTES, DEFAULT_PALETTE, hexToRgb, packRgba, paletteWords, luminance, contrast,
  rampWords, logStep,
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

test('the ramp starts and ends on the palette ends and passes through each height colour', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    const ramp = rampWords(name, 256);
    const words = paletteWords(name);
    assert.equal(ramp.length, 256);
    assert.equal(ramp[0], words[0], name);
    assert.equal(ramp[255], words[3], name);
    assert.equal(rampWords(name, 7)[2], words[1], name);
    assert.equal(rampWords(name, 7)[4], words[2], name);
    assert.ok(p.colors.length === 4);
  }
});

test('log steps are monotone, keep zero dark and make a single toppling visible', () => {
  assert.equal(logStep(0, 1000), 0);
  assert.equal(logStep(1, 1e300), 1);
  assert.equal(logStep(1000, 1000), 255);
  assert.equal(logStep(5, 0), 0);
  let prev = 0;
  for (let v = 1; v <= 1000; v += 7) {
    const k = logStep(v, 1000);
    assert.ok(k >= prev);
    prev = k;
  }
});
