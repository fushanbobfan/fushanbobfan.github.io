import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, encodeSettings, decodeSettings } from '../src/settings.js';
import { SYSTEM_KEYS } from '../src/systems.js';

test('the default view encodes to an empty link', () => {
  assert.equal(encodeSettings(defaultSettings()), '');
  assert.deepEqual(decodeSettings(''), defaultSettings());
});

test('another system with its defaults writes only its name', () => {
  for (const key of SYSTEM_KEYS) {
    const s = defaultSettings(key);
    assert.equal(encodeSettings(s), key === 'lorenz' ? '' : `s=${key}`);
    assert.deepEqual(decodeSettings(encodeSettings(s)), s);
  }
});

test('changed values survive a round trip', () => {
  const s = defaultSettings('rossler');
  s.params.c = 4;
  s.count = 1200;
  s.radius = 0.002;
  s.seed = 123456789;
  s.yaw = -2.1234567;
  s.pitch = 0.9;
  s.zoom = 2.5;
  s.orbit = false;
  const link = encodeSettings(s);
  assert.equal(link, 's=rossler&c=4&count=1200&radius=0.002&seed=123456789&yaw=-2.123&pitch=0.9&zoom=2.5&orbit=0');
  const back = decodeSettings('#' + link);
  assert.equal(back.params.c, 4);
  assert.equal(back.yaw, -2.123);
  assert.equal(back.orbit, false);
  assert.equal(back.seed, 123456789);
});

test('bad or out-of-range values fall back or are clamped', () => {
  const s = decodeSettings('s=nowhere&rho=9999&count=-5&tail=abc&zoom=1e9&speed=2.6');
  assert.equal(s.system, 'lorenz');
  assert.equal(s.params.rho, 200);
  assert.equal(s.count, 1);
  assert.equal(s.tail, 40);
  assert.equal(s.zoom, 12);
  assert.equal(s.speed, 3);
});

test('parameters of another system are ignored', () => {
  const s = decodeSettings('s=thomas&rho=50&b=0.1');
  assert.deepEqual(s.params, { b: 0.1 });
});
