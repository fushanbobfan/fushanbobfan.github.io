import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECS, DEFAULTS, clampParam, normalize, encodeParams, decodeParams,
  sliderRange, toSlider, fromSlider,
} from '../src/params.js';

test('defaults lie inside their ranges', () => {
  for (const [name, spec] of Object.entries(SPECS)) {
    assert.ok(DEFAULTS[name] >= spec.min && DEFAULTS[name] <= spec.max, name);
    assert.equal(clampParam(name, DEFAULTS[name]), DEFAULTS[name]);
  }
});

test('values are clamped to range, rounded, and junk falls back to the default', () => {
  assert.equal(clampParam('beta', 3), 0.95);
  assert.equal(clampParam('beta', -1), 0.05);
  assert.equal(clampParam('gamma', 0.0012345), 0.0012);
  assert.equal(clampParam('gamma', 0.00001234), 0.000012);
  assert.equal(clampParam('gamma', 2), 0.4);
  assert.equal(clampParam('radius', 137), 140);
  assert.equal(clampParam('radius', 5000), 240);
  assert.equal(clampParam('alpha', 'abc'), DEFAULTS.alpha);
  assert.equal(clampParam('alpha', Infinity), DEFAULTS.alpha);
});

test('parameters survive a round trip through a link', () => {
  const p = {
    alpha: 1.3, beta: 0.635, gamma: 0.0035, radius: 90,
  };
  const text = encodeParams(p);
  assert.equal(text, 'a=1.3&b=0.635&g=0.0035&n=90');
  assert.deepEqual(decodeParams(`#${text}`), p);
  assert.deepEqual(decodeParams(`?${text}`), p);
});

test('partial or hostile links give sane parameters, empty ones give null', () => {
  assert.deepEqual(decodeParams('#b=0.9'), { ...DEFAULTS, beta: 0.9 });
  assert.deepEqual(decodeParams('#b=NaN&n=-4&g=1e9'), {
    ...DEFAULTS, beta: DEFAULTS.beta, radius: 40, gamma: 0.4,
  });
  assert.equal(decodeParams(''), null);
  assert.equal(decodeParams('#x=1'), null);
  assert.equal(decodeParams(undefined), null);
  assert.deepEqual(normalize(), DEFAULTS);
});

test('the gamma slider is logarithmic with zero at its left end', () => {
  const range = sliderRange('gamma');
  assert.equal(fromSlider('gamma', range.min), 0);
  assert.equal(fromSlider('gamma', range.max), 0.4);
  assert.equal(toSlider('gamma', 0), 0);
  assert.equal(toSlider('gamma', 0.4), range.max);
  const mid = fromSlider('gamma', range.max / 2);
  assert.ok(Math.abs(mid - Math.sqrt(1e-5 * 0.4)) / mid < 0.02, `${mid}`);
  for (const g of [0.0001, 0.001, 0.003, 0.02, 0.3]) {
    const back = fromSlider('gamma', toSlider('gamma', g));
    assert.ok(Math.abs(back - g) / g < 0.01, `${g} -> ${back}`);
  }
});

test('linear sliders pass values straight through', () => {
  assert.deepEqual(sliderRange('beta'), { min: 0.05, max: 0.95, step: 0.005 });
  assert.equal(toSlider('beta', 0.4), 0.4);
  assert.equal(fromSlider('beta', '0.4'), 0.4);
  assert.equal(fromSlider('radius', '123'), 120);
});
