import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, hexToRgb, buildLut, paintTrail, toneScale, paintColonies } from '../src/render.js';
import { createTrail, setWall } from '../src/trail.js';

test('hex colours parse to bytes', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.deepEqual(hexToRgb('#05060a'), [5, 6, 10]);
});

test('a palette table starts and ends on its first and last stops', () => {
  for (const { stops } of Object.values(PALETTES)) {
    const lut = buildLut(stops);
    assert.deepEqual([...lut.slice(0, 3)], hexToRgb(stops[0]));
    assert.deepEqual([...lut.slice(765, 768)], hexToRgb(stops[stops.length - 1]));
  }
});

test('a two-stop table interpolates linearly', () => {
  const lut = buildLut(['#000000', '#ff0000']);
  assert.equal(lut[128 * 3], 128);
  assert.equal(lut[128 * 3 + 1], 0);
});

test('dark palettes get brighter with more trail and ink gets darker', () => {
  const lum = (lut, i) => lut[i * 3] + lut[i * 3 + 1] + lut[i * 3 + 2];
  for (const [name, { stops }] of Object.entries(PALETTES)) {
    const lut = buildLut(stops);
    const rising = lum(lut, 255) > lum(lut, 0);
    assert.equal(rising, name !== 'ink', name);
  }
});

test('empty cells take the first colour and thicker trail never gets dimmer', () => {
  const t = createTrail(4, 1);
  t.data.set([0, 1, 5, 50]);
  const px = new Uint8ClampedArray(16);
  const lut = buildLut(['#000000', '#ffffff']);
  paintTrail(t, px, lut, 1);
  assert.deepEqual([...px.slice(0, 4)], [0, 0, 0, 255]);
  assert.ok(px[4] <= px[8] && px[8] <= px[12]);
  assert.ok(px[12] > 128);
});

test('the tone scale follows the mean and exposure', () => {
  const t = createTrail(2, 1);
  t.data.set([2, 6]);
  assert.equal(toneScale(t, 1), 16);
  assert.equal(toneScale(t, 2), 8);
  assert.equal(toneScale(createTrail(2, 2), 1), 1);
});

test('walls are painted flat in the wall colour', () => {
  const t = createTrail(2, 1);
  setWall(t, 1, true);
  const px = new Uint8ClampedArray(8);
  paintTrail(t, px, buildLut(['#000000', '#ffffff']), 1, hexToRgb(PALETTES.slime.wall));
  assert.deepEqual([...px.slice(4, 8)], [...hexToRgb(PALETTES.slime.wall), 255]);
  for (const p of Object.values(PALETTES)) assert.match(p.wall, /^#[0-9a-f]{6}$/);
});

test('each palette names three distinct colony colours', () => {
  for (const p of Object.values(PALETTES)) {
    assert.equal(new Set(p.colonies).size, 3);
    for (const c of p.colonies) assert.match(c, /^#[0-9a-f]{6}$/);
  }
});

test('colonies tint the background towards their own colour', () => {
  // Thick tubes on a mostly empty dish, as in a running simulation.
  const a = createTrail(40, 1);
  const b = createTrail(40, 1);
  a.data[1] = 50;
  b.data[2] = 50;
  const px = new Uint8ClampedArray(160);
  const pal = PALETTES.slime;
  paintColonies([a, b], px, pal, 1);
  assert.deepEqual([...px.slice(0, 3)], hexToRgb(pal.stops[0]));
  const [c0, c1] = pal.colonies.map(hexToRgb);
  const near = (got, want) => got.every((v, i) => Math.abs(v - want[i]) < 40);
  assert.ok(near([...px.slice(4, 7)], c0), `${[...px.slice(4, 7)]}`);
  assert.ok(near([...px.slice(8, 11)], c1), `${[...px.slice(8, 11)]}`);
});
