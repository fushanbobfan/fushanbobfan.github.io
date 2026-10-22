import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, encodeSettings, decodeSettings } from '../src/settings.js';

test('an empty hash gives the defaults', () => {
  assert.deepEqual(decodeSettings(''), DEFAULTS);
  assert.deepEqual(decodeSettings(undefined), DEFAULTS);
});

test('settings survive a round trip at full precision', () => {
  const s = {
    c: [-0.7453123456789012, 0.11270000000000001],
    mview: [-0.743643887037151, 0.13182590420533, 1.2e-11],
    jview: [0.1, -0.2, 2.5],
    iterations: 4000,
    palette: 'tide',
    colouring: 'boundary',
    interior: 'dark',
    density: 2.5,
    offset: 0.35,
  };
  const hash = encodeSettings(s);
  assert.ok(hash.startsWith('#c=-0.745312345678901'), hash);
  assert.ok(!hash.includes('%2C'));
  assert.deepEqual(decodeSettings(hash), s);
});

test('bad or out-of-range values fall back one by one', () => {
  const s = decodeSettings('#c=nope&m=0,0,-1&j=0,0&it=2.5&pal=neon&col=x&int=y&den=50&off=2');
  assert.deepEqual(s, DEFAULTS);
  assert.equal(decodeSettings('#int=period').interior, 'period');
  assert.equal(decodeSettings('#int=phase').interior, 'phase');
  const t = decodeSettings('#c=0.25,0&pal=moss&off=0.5');
  assert.deepEqual(t.c, [0.25, 0]);
  assert.equal(t.palette, 'moss');
  assert.equal(t.offset, 0.5);
  assert.deepEqual(t.mview, DEFAULTS.mview);
});

test('decoding never shares arrays with the defaults', () => {
  const s = decodeSettings('');
  s.c[0] = 99;
  assert.notEqual(DEFAULTS.c[0], 99);
});
