import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, findPreset, mulberry32, randomDesign } from '../src/presets.js';
import { normalizeDesign, sampleCurve, envelope, settleTime } from '../src/harmonograph.js';

test('every preset has a unique id, a description and a valid design', () => {
  const ids = new Set();
  for (const preset of PRESETS) {
    assert.ok(!ids.has(preset.id), `duplicate id ${preset.id}`);
    ids.add(preset.id);
    assert.ok(preset.name && preset.description);
    assert.ok(preset.design.pendulums.length >= 2);
    assert.deepEqual(normalizeDesign(preset.design), preset.design);
  }
});

test('presets reach no further than the corners of the unit square', () => {
  for (const preset of PRESETS) {
    assert.ok(envelope(preset.design, 0) <= Math.SQRT2 + 1e-9, preset.id);
    const pts = sampleCurve(preset.design, { duration: 20, samplesPerSecond: 60 });
    assert.ok(pts.every(Number.isFinite), preset.id);
  }
});

test('the undamped preset never settles and the others do', () => {
  for (const preset of PRESETS) {
    const t = settleTime(preset.design, 0.05, 1000);
    if (preset.id === 'undamped-knot') assert.equal(t, 1000);
    else assert.ok(t < 1000, preset.id);
  }
});

test('findPreset returns null for unknown ids', () => {
  assert.equal(findPreset('lissajous-3-2').name, 'Lissajous 3:2');
  assert.equal(findPreset('nope'), null);
});

test('mulberry32 is deterministic and stays in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('randomDesign is reproducible from its seed and always has both axes', () => {
  assert.deepEqual(randomDesign(7), randomDesign(7));
  assert.notDeepEqual(randomDesign(7), randomDesign(8));
  for (let seed = 0; seed < 200; seed++) {
    const d = randomDesign(seed);
    const axes = new Set(d.pendulums.map((p) => p.axis));
    assert.ok(axes.has('x') && axes.has('y'), `seed ${seed}`);
    assert.ok(d.pendulums.every((p) => p.damp > 0), `seed ${seed}`);
  }
});
