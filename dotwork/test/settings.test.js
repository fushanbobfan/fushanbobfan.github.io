import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, encodeSettings, decodeSettings, clampSetting, PALETTES, VIEWS } from '../src/settings.js';

test('default settings make an empty link', () => {
  assert.equal(encodeSettings(defaults()), '');
  assert.deepEqual(decodeSettings(''), defaults());
});

test('changed settings survive a round trip', () => {
  const s = { ...defaults(), dots: 9000, gamma: 1.4, picture: 'spiral', view: 'line', palette: 'chalk', invert: true, seed: 77 };
  const link = encodeSettings(s);
  assert.match(link, /dots=9000/);
  assert.doesNotMatch(link, /contrast/);
  assert.deepEqual(decodeSettings(link), s);
});

test('bad values are clamped or ignored', () => {
  const s = decodeSettings('dots=999999&gamma=abc&picture=selfie&view=line&invert=yes&evil=1');
  assert.equal(s.dots, 20000);
  assert.equal(s.gamma, defaults().gamma);
  assert.equal(s.picture, defaults().picture);
  assert.equal(s.view, 'line');
  assert.equal(s.invert, false);
  assert.ok(!('evil' in s));
});

test('integer settings are rounded', () => {
  assert.equal(clampSetting('dots', 1234.6), 1235);
  assert.equal(clampSetting('size', 1.234), 1.234);
});

test('every palette has two colours and every view a name', () => {
  for (const p of Object.values(PALETTES)) assert.match(p.ink + p.paper, /^#[0-9a-f]{6}#[0-9a-f]{6}$/);
  assert.ok(VIEWS.includes('dots') && VIEWS.includes('line'));
});
