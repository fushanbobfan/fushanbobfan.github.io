import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, PRESETS, encode, decode } from '../src/settings.js';
import { PATHS } from '../src/path.js';

test('the defaults encode to an empty link', () => {
  assert.equal(encode(DEFAULTS), '');
  assert.deepEqual(decode(''), DEFAULTS);
});

test('changed values survive a round trip', () => {
  const s = { ...DEFAULTS, path: 'circle', mach: 1.35, lx: 0.25, cone: false };
  assert.deepEqual(decode('#' + encode(s)), s);
});

test('out-of-range and malformed values are clamped or ignored', () => {
  const s = decode('mach=9&rate=-3&lx=abc&path=spiral&tint=0');
  assert.equal(s.mach, 2.5);
  assert.equal(s.rate, 0.5);
  assert.equal(s.lx, DEFAULTS.lx);
  assert.equal(s.path, DEFAULTS.path);
  assert.equal(s.tint, false);
});

test('every preset names a known path and an allowed speed', () => {
  for (const p of Object.values(PRESETS)) {
    assert.ok(PATHS.includes(p.path));
    assert.ok(p.mach >= 0 && p.mach <= 2.5);
  }
});
