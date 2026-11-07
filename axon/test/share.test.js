import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMembrane, encodeMembrane, hasMembraneFields } from '../src/share.js';
import { DEFAULTS, presetSettings } from '../src/presets.js';

test('every preset survives a trip through a link', () => {
  for (const id of ['push', 'soon', 'steady', 'rebound', 'no-sodium', 'low-potassium', 'warm']) {
    const settings = presetSettings(id);
    const params = new URLSearchParams(encodeMembrane(settings).toString());
    assert.deepEqual(decodeMembrane(params), settings, id);
  }
});

test('defaults make an empty link', () => {
  assert.equal(encodeMembrane(DEFAULTS).toString(), '');
  assert.equal(hasMembraneFields(new URLSearchParams('')), false);
  assert.equal(hasMembraneFields(new URLSearchParams('k=50')), true);
});

test('nonsense in a link falls back to defaults', () => {
  const settings = decodeMembrane(new URLSearchParams('a=9999&t=hot&k=-5&l=50&two=maybe'));
  assert.deepEqual(settings, { ...DEFAULTS });
});
