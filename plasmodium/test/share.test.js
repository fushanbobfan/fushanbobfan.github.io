import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, VIEW_DEFAULTS } from '../src/share.js';
import { DEFAULTS, normalizeSettings } from '../src/sim.js';
import { presetSettings, PRESETS } from '../src/presets.js';

test('the defaults encode to an empty hash', () => {
  assert.equal(encodeState({ settings: normalizeSettings({}) }), '');
  const back = decodeState('');
  assert.deepEqual(back.settings, normalizeSettings({}));
  assert.deepEqual(back.foods, []);
  assert.deepEqual(back.view, VIEW_DEFAULTS);
});

test('every preset survives a round trip with its food and view', () => {
  for (const name of Object.keys(PRESETS)) {
    const settings = normalizeSettings({ ...presetSettings(name), seed: 123456789 });
    const foods = [{ x: 10, y: 20 }, { x: 100, y: 5 }];
    const view = { palette: 'ink', exposure: 1.5 };
    const back = decodeState('#' + encodeState({ settings, foods, view }));
    assert.deepEqual(back.settings, settings, name);
    assert.deepEqual(back.foods, foods);
    assert.deepEqual(back.view, view);
  }
});

test('only changed values are written', () => {
  const hash = encodeState({ settings: normalizeSettings({ sensorAngle: 45, wrap: false }) });
  assert.equal(hash, 'sa=45&wr=0');
});

test('bad input falls back to safe values', () => {
  const { settings, foods, view } = decodeState('#sa=abc&n=9999999&f=1.2_x.y_-5.3_999999.1&pal=neon&ex=-2&l=toString');
  assert.equal(settings.layout, DEFAULTS.layout);
  assert.equal(settings.sensorAngle, DEFAULTS.sensorAngle);
  assert.equal(settings.population, 400000);
  assert.deepEqual(foods, [{ x: 1, y: 2 }]);
  assert.deepEqual(view, VIEW_DEFAULTS);
});

test('a maze travels as its recipe and painted walls as their code', () => {
  const settings = normalizeSettings({ wrap: false });
  const maze = { seed: 42, corridor: 16, thickness: 4, loops: 0.15 };
  const a = decodeState('#' + encodeState({ settings, maze, walls: '5-3-9' }));
  assert.deepEqual(a.maze, maze);
  assert.equal(a.walls, '');
  const b = decodeState('#' + encodeState({ settings, walls: '5-3-9' }));
  assert.equal(b.maze, null);
  assert.equal(b.walls, '5-3-9');
});

test('maze recipes are clamped to sensible sizes', () => {
  const { maze } = decodeState('#mz=1.0.99.500');
  assert.deepEqual(maze, { seed: 1, corridor: 2, thickness: 20, loops: 1 });
  assert.equal(decodeState('#mz=1.2').maze, null);
});

test('colonies and repel travel in the link', () => {
  const settings = normalizeSettings({ colonies: 3, repel: 0.5 });
  assert.equal(encodeState({ settings }), 'col=3&rp=0.5');
  assert.deepEqual(decodeState('#col=3&rp=0.5').settings, settings);
});
