import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeDesign, decodeDesign } from '../src/share.js';
import { PRESETS } from '../src/presets.js';
import { normalizeDesign } from '../src/harmonograph.js';

test('encodeDesign writes one short token per pendulum', () => {
  const design = normalizeDesign({
    pendulums: [
      { axis: 'x', amp: 0.5, freq: 2, phase: 0, damp: 0.01 },
      { axis: 'rotary', amp: 0.25, freq: 0.5, phase: 1.5707963, damp: 0 },
    ],
  });
  assert.equal(encodeDesign(design), 'x:0.5,2,0,0.01;r:0.25,0.5,1.571,0');
});

test('every preset survives a round trip within the encoded precision', () => {
  for (const preset of PRESETS) {
    const decoded = decodeDesign('#' + encodeDesign(preset.design));
    assert.equal(decoded.pendulums.length, preset.design.pendulums.length);
    decoded.pendulums.forEach((p, i) => {
      const q = preset.design.pendulums[i];
      assert.equal(p.axis, q.axis);
      assert.ok(Math.abs(p.amp - q.amp) <= 5e-4);
      assert.ok(Math.abs(p.freq - q.freq) <= 5e-5);
      assert.ok(Math.abs(p.phase - q.phase) <= 5e-4);
      assert.ok(Math.abs(p.damp - q.damp) <= 5e-5);
    });
  }
});

test('decodeDesign rejects malformed text instead of guessing', () => {
  for (const bad of [null, '', '#', 'q:1,2,3,4', 'x:1,2,3', 'x:1,2,a,4', 'x1,2,3,4', 'x:1,2,3,4;;']) {
    assert.equal(decodeDesign(bad), null, String(bad));
  }
});

test('decodeDesign clamps hand-edited values into range', () => {
  const d = decodeDesign('x:9,100,0,-1');
  assert.deepEqual(d.pendulums[0], { axis: 'x', amp: 1, freq: 12, phase: 0, damp: 0 });
});
