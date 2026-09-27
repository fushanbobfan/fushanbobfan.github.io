import test from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, DEFAULTS } from '../src/elements.js';
import {
  PARAMS, LABELS, applyParam, hasMaterial, visibleParams,
} from '../src/params.js';

test('every element kind has a label and editable parameters that exist on it', () => {
  for (const kind of Object.keys(DEFAULTS)) {
    assert.ok(LABELS[kind], kind);
    const el = makeElement(kind, 0, 0);
    for (const spec of PARAMS[kind]) {
      assert.ok(spec.key in el, `${kind}.${spec.key}`);
      assert.ok(el[spec.key] >= spec.min && el[spec.key] <= spec.max, `${kind}.${spec.key} default in range`);
    }
  }
});

test('edits are clamped to range and bad input is ignored', () => {
  const prism = makeElement('prism', 0, 0);
  applyParam(prism, 'apex', 500);
  assert.equal(prism.apex, 120);
  applyParam(prism, 'apex', 'abc');
  assert.equal(prism.apex, 120);
  applyParam(prism, 'nonsense', 3);
  assert.equal(prism.nonsense, undefined);
});

test('angle is edited in degrees and stored in radians', () => {
  const el = makeElement('laser', 0, 0);
  applyParam(el, 'angle', 90);
  assert.ok(Math.abs(el.angle - Math.PI / 2) < 1e-12);
});

test('materials are only accepted from the known list and only on glass', () => {
  const block = makeElement('block', 0, 0);
  applyParam(block, 'material', 'sf10');
  assert.equal(block.material, 'sf10');
  applyParam(block, 'material', 'unobtainium');
  assert.equal(block.material, 'sf10');
  assert.ok(hasMaterial(block));
  assert.ok(!hasMaterial(makeElement('mirror', 0, 0)));
});

test('a curved surface keeps its radius larger than its half-height', () => {
  const lens = makeElement('convexLens', 0, 0, 0, { radius: 100, aperture: 50 });
  applyParam(lens, 'aperture', 150);
  assert.ok(lens.radius > lens.aperture);
  applyParam(lens, 'radius', 60);
  assert.ok(lens.radius > lens.aperture);
});

test('sources switch between one wavelength and white light, showing the matching controls', () => {
  const beam = makeElement('beam', 0, 0);
  const keys = () => visibleParams(beam).map((p) => p.key);
  assert.ok(keys().includes('wavelength') && !keys().includes('samples'));
  applyParam(beam, 'light', 'white');
  assert.equal(beam.light, 'white');
  assert.ok(!keys().includes('wavelength') && keys().includes('samples'));
  applyParam(beam, 'light', 'ultraviolet');
  assert.equal(beam.light, 'white');
  const prism = makeElement('prism', 0, 0);
  applyParam(prism, 'light', 'white');
  assert.equal(prism.light, undefined);
  assert.deepEqual(visibleParams(prism), PARAMS.prism);
});
