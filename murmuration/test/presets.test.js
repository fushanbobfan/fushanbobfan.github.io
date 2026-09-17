import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULT_PRESET, presetParams } from '../src/presets.js';
import { DEFAULT_PARAMS } from '../src/flock.js';

test('the default preset exists', () => {
  assert.ok(PRESETS[DEFAULT_PRESET]);
});

test('every preset has a label, description and only known parameter keys', () => {
  const known = new Set(Object.keys(DEFAULT_PARAMS));
  for (const [name, preset] of Object.entries(PRESETS)) {
    assert.equal(typeof preset.label, 'string', name);
    assert.equal(typeof preset.description, 'string', name);
    for (const key of Object.keys(preset.params)) assert.ok(known.has(key), `${name}.${key}`);
  }
});

test('presetParams fills in defaults and rejects unknown names', () => {
  const p = presetParams('scatter');
  assert.equal(p.cohesion, 0);
  assert.equal(p.maxSpeed, DEFAULT_PARAMS.maxSpeed);
  assert.throws(() => presetParams('nope'), RangeError);
});

test('preset values are physically sane', () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    const p = presetParams(name);
    assert.ok(p.perception > 0 && p.maxSpeed > 0 && p.maxForce > 0, name);
    assert.ok(p.separationRadius <= p.perception, `${name}: separation radius inside perception`);
    for (const w of ['separation', 'alignment', 'cohesion']) assert.ok(p[w] >= 0, `${name}.${w}`);
  }
});
