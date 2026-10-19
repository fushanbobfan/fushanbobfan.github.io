import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  PRESETS,
  clampSettings,
  decodeSettings,
  encodeSettings,
  gridHeight,
  presetSettings,
} from '../src/settings.js';

test('defaults encode to an empty link and decode back', () => {
  assert.equal(encodeSettings(DEFAULTS), '');
  assert.deepEqual(decodeSettings(''), DEFAULTS);
});

test('a changed setting round-trips through the link alone', () => {
  const s = { ...DEFAULTS, shape: 'airfoil', naca: '4412', angle: 12, tracers: false, width: 400 };
  const q = encodeSettings(s);
  assert.equal(q, 'shape=airfoil&naca=4412&angle=12&width=400&tracers=0');
  assert.deepEqual(decodeSettings(q), s);
});

test('out-of-range and malformed values fall back or clamp', () => {
  const s = decodeSettings('shape=blob&re=99999&size=2.6&width=333&naca=99&view=x&speed=abc');
  assert.equal(s.shape, 'cylinder');
  assert.equal(s.re, 2000);
  assert.equal(s.size, 8);
  assert.equal(s.width, 300);
  assert.equal(s.naca, '2412');
  assert.equal(s.view, 'curl');
  assert.equal(s.speed, 0.1);
  assert.equal(clampSettings({ naca: '2402' }).naca, '2412');
});

test('every preset is valid as given and fits inside its tunnel', () => {
  for (const p of PRESETS) {
    const s = presetSettings(p.id);
    for (const [k, v] of Object.entries(p.settings)) assert.equal(s[k], v, `${p.id}.${k}`);
    assert.ok(s.size * 3 < gridHeight(s.width), p.id);
  }
});
