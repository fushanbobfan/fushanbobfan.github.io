import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLattice } from '../src/lattice.js';
import { labelClusters } from '../src/clusters.js';
import { PALETTES, clusterColour, gridDimensions, hexToRgb, hslToRgb, paintBurn, paintGrid, siteAtPixel } from '../src/render.js';
import { burn } from '../src/burn.js';

const pixel = (img, x, y) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];

test('colour helpers', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.deepEqual(hslToRgb(0, 1, 0.5), [255, 0, 0]);
  assert.deepEqual(hslToRgb(120, 1, 0.5), [0, 255, 0]);
  assert.deepEqual(hslToRgb(0, 0, 1), [255, 255, 255]);
  assert.deepEqual(clusterColour(PALETTES.sea, 3), clusterColour(PALETTES.sea, 3));
  assert.notDeepEqual(clusterColour(PALETTES.sea, 3), clusterColour(PALETTES.sea, 4));
});

test('site grids paint one opaque pixel per site', () => {
  const lat = createLattice({ size: 20, seed: 3 });
  const result = labelClusters(lat, 0.55);
  const img = paintGrid(lat, 0.55, result);
  assert.equal(img.width, 20);
  assert.equal(img.data.length, 20 * 20 * 4);
  for (let i = 3; i < img.data.length; i += 4) assert.equal(img.data[i], 255);
  const closed = hexToRgb(PALETTES.ink.closed);
  for (let i = 0; i < 400; i++) {
    const got = pixel(img, i % 20, Math.floor(i / 20));
    if (result.label[i] < 0) assert.deepEqual(got, closed);
    else assert.notDeepEqual(got, closed);
  }
});

test('the spanning cluster gets the palette accent in every colouring', () => {
  const lat = createLattice({ size: 32, seed: 1 });
  const result = labelClusters(lat, 0.7);
  const k = result.clusters.findIndex((c) => c.spans);
  assert.ok(k >= 0);
  const site = result.label.indexOf(k);
  for (const colouring of ['clusters', 'spanning', 'size']) {
    const img = paintGrid(lat, 0.7, result, { colouring, palette: PALETTES.ember });
    assert.deepEqual(pixel(img, site % 32, Math.floor(site / 32)), hexToRgb(PALETTES.ember.span));
  }
});

test('the spanning colouring greys out every other cluster', () => {
  const lat = createLattice({ size: 32, seed: 1 });
  const result = labelClusters(lat, 0.4);
  assert.equal(result.clusters.some((c) => c.spans), false);
  const img = paintGrid(lat, 0.4, result, { colouring: 'spanning' });
  const site = result.label.findIndex((k) => k >= 0);
  assert.deepEqual(pixel(img, site % 32, Math.floor(site / 32)), hexToRgb(PALETTES.ink.idle));
});

test('bond grids draw sites on even pixels and open bonds between them', () => {
  const lat = createLattice({ size: 10, mode: 'bond', seed: 4 });
  const result = labelClusters(lat, 0.6);
  const img = paintGrid(lat, 0.6, result);
  assert.deepEqual(gridDimensions(lat), { width: 19, height: 19 });
  const closed = hexToRgb(PALETTES.ink.closed);
  for (let i = 0; i < 100; i++) {
    const x = i % 10;
    const y = Math.floor(i / 10);
    if (x < 9) assert.equal(lat.right[i] < 0.6, String(pixel(img, 2 * x + 1, 2 * y)) !== String(closed));
    if (y < 9) assert.equal(lat.down[i] < 0.6, String(pixel(img, 2 * x, 2 * y + 1)) !== String(closed));
  }
  // Pixels at odd/odd positions never carry anything.
  assert.deepEqual(pixel(img, 1, 1), closed);
});

test('pixels map back to the site under them', () => {
  const site = createLattice({ size: 16, seed: 1 });
  assert.equal(siteAtPixel(site, 3, 2), 35);
  assert.equal(siteAtPixel(site, -1, 0), -1);
  const bond = createLattice({ size: 16, mode: 'bond', seed: 1 });
  assert.equal(siteAtPixel(bond, 6, 4), 2 * 16 + 3);
  assert.equal(siteAtPixel(bond, 30, 30), 255);
});

test('the burning view marks the front, the burnt cells and the ones still waiting', () => {
  for (const mode of ['site', 'bond']) {
    const lat = createLattice({ size: 24, mode, seed: 8 });
    const fire = burn(lat, 0.7);
    const step = Math.floor(fire.steps / 2);
    const palette = PALETTES.sea;
    const img = paintBurn(lat, 0.7, fire, step, { palette });
    const scale = mode === 'bond' ? 2 : 1;
    const seen = { front: 0, waiting: 0, burnt: 0 };
    for (let i = 0; i < 24 * 24; i++) {
      if (mode === 'site' && lat.site[i] >= 0.7) continue;
      const got = String(pixel(img, (i % 24) * scale, Math.floor(i / 24) * scale));
      const t = fire.time[i];
      if (t === step) { assert.equal(got, String(hexToRgb(palette.span))); seen.front++; }
      else if (t < 0 || t > step) { assert.equal(got, String(hexToRgb(palette.idle))); seen.waiting++; }
      else { assert.notEqual(got, String(hexToRgb(palette.idle))); seen.burnt++; }
    }
    assert.ok(seen.front && seen.waiting && seen.burnt, `${mode} ${JSON.stringify(seen)}`);
  }
});
