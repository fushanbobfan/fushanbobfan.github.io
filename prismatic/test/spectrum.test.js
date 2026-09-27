import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wavelengthToRGB, wavelengthToCss, spectrumSamples, whiteShare,
} from '../src/spectrum.js';

test('spectrum colours run from violet through green to red and fade outside the visible range', () => {
  const [r1, , b1] = wavelengthToRGB(400);
  assert.ok(b1 > r1);
  const [, g2] = wavelengthToRGB(530);
  assert.ok(g2 === 1);
  const [r3, g3, b3] = wavelengthToRGB(680);
  assert.ok(r3 === 1 && g3 === 0 && b3 === 0);
  assert.deepEqual(wavelengthToRGB(300), [0, 0, 0]);
  assert.deepEqual(wavelengthToRGB(900), [0, 0, 0]);
  assert.equal(wavelengthToCss(680, 0.5), 'rgba(255, 0, 0, 0.5)');
});

test('white light is sampled evenly across the visible band', () => {
  assert.deepEqual(spectrumSamples(3), [450, 550, 650]);
  const many = spectrumSamples(12);
  assert.equal(many.length, 12);
  assert.ok(many[0] > 400 && many[11] < 700);
  for (let i = 1; i < many.length; i++) assert.ok(many[i] > many[i - 1]);
  assert.deepEqual(spectrumSamples(0), [550]);
});

test('white share brings the summed colour to full scale in its strongest channel', () => {
  const wls = spectrumSamples(12);
  const share = whiteShare(wls);
  const sum = [0, 0, 0];
  for (const wl of wls) wavelengthToRGB(wl).forEach((c, i) => { sum[i] += c * share; });
  assert.ok(Math.abs(Math.max(...sum) - 1) < 1e-12);
  assert.ok(Math.min(...sum) > 0.5, `summed white is too tinted: ${sum}`);
});
