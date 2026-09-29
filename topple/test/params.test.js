import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECS, DEFAULTS, clampParam, normalize, encodeParams, decodeParams, towerSide,
} from '../src/params.js';
import { createPile, index, addGrains, sweep } from '../src/sandpile.js';

test('defaults are valid', () => {
  for (const name of Object.keys(SPECS)) assert.equal(clampParam(name, DEFAULTS[name]), DEFAULTS[name]);
});

test('numbers are clamped and rounded, choices fall back to the default', () => {
  assert.equal(clampParam('power', 40), 17);
  assert.equal(clampParam('power', '9.6'), 10);
  assert.equal(clampParam('size', -3), 16);
  assert.equal(clampParam('size', 'abc'), DEFAULTS.size);
  assert.equal(clampParam('mode', 'volcano'), 'tower');
  assert.equal(clampParam('palette', 'tide'), 'tide');
});

test('settings survive a link round trip', () => {
  const p = {
    mode: 'rain', power: 12, size: 64, palette: 'ember', seed: 77,
  };
  const text = encodeParams(p);
  assert.equal(text, 'm=rain&p=12&s=64&c=ember&r=77');
  assert.deepEqual(decodeParams(`#${text}`), p);
});

test('partial links fill in defaults and foreign links give null', () => {
  assert.deepEqual(decodeParams('#m=identity&s=9999'), { ...DEFAULTS, mode: 'identity', size: 256 });
  assert.equal(decodeParams('#foo=1'), null);
  assert.equal(decodeParams(''), null);
  assert.deepEqual(normalize({}), DEFAULTS);
});

test('tower grids are odd and big enough that no grain falls off', () => {
  for (let p = SPECS.power.min; p <= 13; p++) {
    const n = 2 ** p;
    const side = towerSide(n);
    assert.equal(side % 2, 1);
    const pile = createPile(side, side);
    const c = (side - 1) / 2;
    addGrains(pile, index(pile, c, c), n);
    sweep(pile);
    assert.equal(pile.lost, 0, `2^${p}`);
  }
});
