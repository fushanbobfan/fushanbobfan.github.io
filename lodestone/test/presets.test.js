import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, presetById } from '../src/presets.js';
import { makeSystem } from '../src/model.js';
import { BasinMap } from '../src/basins.js';

const build = (p) => makeSystem(p.magnets, { pull: p.pull, friction: p.friction, height: p.height });

function borderShare(map) {
  const n = map.size;
  let diff = 0;
  let pairs = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      pairs += 2;
      if (map.magnet[r * n + c] !== map.magnet[r * n + c + 1]) diff++;
      if (map.magnet[c * n + r] !== map.magnet[(c + 1) * n + r]) diff++;
    }
  }
  return diff / pairs;
}

function finished(p, size = 48) {
  const map = new BasinMap(build(p), size);
  while (!map.complete) map.work(1e9);
  return map;
}

test('setups have unique ids, a note, and a well under every magnet', () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  for (const p of PRESETS) {
    assert.ok(p.note.length > 40, p.id);
    assert.ok(build(p).traps.every((t) => t.hasWell), p.id);
  }
});

test('an unknown id falls back to the first setup', () => {
  assert.equal(presetById('nope'), PRESETS[0]);
  assert.equal(presetById('four').id, 'four');
});

test('less friction braids more of the map, more friction less', () => {
  const base = borderShare(finished(presetById('three')));
  assert.ok(borderShare(finished(presetById('slippery'))) > 1.5 * base);
  assert.ok(borderShare(finished(presetById('sticky'))) < 0.5 * base);
});

test('the strong magnet catches more than half the starting points', () => {
  const { fractions } = finished(presetById('lopsided')).shares();
  assert.ok(fractions[0] > 0.5, `share ${fractions[0]}`);
});

test('the stiff centre pull braids more of the map than the first setup', () => {
  assert.ok(borderShare(finished(presetById('stiff'))) > 1.3 * borderShare(finished(presetById('three'))));
});
