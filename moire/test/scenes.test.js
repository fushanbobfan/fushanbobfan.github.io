import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS } from '../src/gratings.js';
import { SCENES, sceneById, sceneLayers } from '../src/scenes.js';
import { describe } from '../src/readout.js';
import { latticeMoire, lineMoire, ringMoire, visibleBeat } from '../src/moire.js';

test('every scene has two valid layers and a note', () => {
  const ids = new Set();
  for (const scene of SCENES) {
    assert.ok(!ids.has(scene.id), `duplicate ${scene.id}`);
    ids.add(scene.id);
    assert.ok(scene.note.length > 40);
    const layers = sceneLayers(scene, 500, 400);
    assert.equal(layers.length, 2);
    for (const l of layers) {
      assert.ok(KINDS.includes(l.kind));
      assert.ok(l.period >= 3 && l.period <= 30);
      assert.ok(l.duty > 0 && l.duty < 1);
    }
  }
});

test('scene positions are measured from the middle of the view', () => {
  const [a, b] = sceneLayers(sceneById('two-centres'), 500, 400);
  assert.deepEqual([a.x, a.y, b.x, b.y], [210, 200, 290, 200]);
  assert.equal(sceneById('nope'), SCENES[0]);
});

test('the numbers quoted in scene notes match the model', () => {
  const [va, vb] = sceneLayers(sceneById('vernier'), 600, 600);
  assert.ok(Math.abs(lineMoire(va, vb).magnification - 20) < 1e-9);
  const [ca, cb] = sceneLayers(sceneById('concentric'), 600, 600);
  assert.ok(Math.abs(ringMoire(ca, cb).spacing - 110) < 1e-9);
  const [da, db] = sceneLayers(sceneById('dots-turned'), 600, 600);
  const turned = latticeMoire(da, db);
  assert.equal(Math.round(turned.sides[0]), 129);
  assert.ok(Math.abs(turned.turnDegrees - 2) < 1e-9);
  const [ha, hb] = sceneLayers(sceneById('harmonic'), 600, 600);
  assert.ok(Math.abs(lineMoire(ha, hb).period - 16.42) < 0.01);
  assert.ok(Math.abs(visibleBeat(ha, hb).period - 312) < 1e-6);
  const [sa, sb] = sceneLayers(sceneById('dots-stretched'), 600, 600);
  assert.ok(Math.abs(latticeMoire(sa, sb).sides[0] - 171) < 1e-6);
});

test('every scene gets a readout with no placeholders', () => {
  for (const scene of SCENES) {
    const [a, b] = sceneLayers(scene, 600, 600);
    const text = describe(a, b);
    assert.ok(text.length > 20);
    assert.ok(!/undefined|NaN|null/.test(text), `${scene.id}: ${text}`);
  }
});
