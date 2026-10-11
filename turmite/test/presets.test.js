import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRule } from '../src/rules.js';
import { Colony } from '../src/colony.js';
import { PRESETS, presetById } from '../src/presets.js';

const lone = (id) => new Colony(parseRule(presetById(id).rule).rule, [{ x: 0, y: 0, dir: 0 }]);

const filled = (c) => {
  const { minX, maxX, minY, maxY } = c.box;
  let n = 0;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (c.grid.get(x, y)) n++;
  return { n, w: maxX - minX + 1, h: maxY - minY + 1 };
};

test('every preset parses, has a unique id and a note', () => {
  const ids = new Set();
  for (const p of PRESETS) {
    assert.ok(parseRule(p.rule).ok, p.id);
    assert.ok(p.note.length > 20, p.id);
    ids.add(p.id);
  }
  assert.equal(ids.size, PRESETS.length);
  assert.equal(presetById('nope'), null);
});

test("Langton's ant: highway at step 9977, period 104", () => {
  const c = lone('langton');
  c.run(9977 + 104 * 3 + 4096);
  assert.equal(c.highway.onset, 9977);
  assert.equal(c.highway.period, 104);
  assert.equal(Math.abs(c.highway.dx), Math.abs(c.highway.dy), 'diagonal');
});

test('RLR: no highway in two million steps', () => {
  const c = lone('chaos');
  c.run(2_000_000);
  assert.equal(c.highway, null);
  assert.equal(c.halted, null);
});

test('LLRR: mirror image whenever the ant is home facing up', () => {
  const c = lone('mirror');
  let checked = 0;
  for (let s = 0; s < 60_000; s++) {
    c.run(1);
    const a = c.ants[0];
    if (a.x !== 0 || a.y !== 0 || a.dir !== 0) continue;
    const { minX, maxX, minY, maxY } = c.box;
    for (let y = minY - 1; y <= maxY + 1; y++) {
      for (let x = minX; x <= maxX; x++) assert.equal(c.grid.get(x, y), c.grid.get(x, 1 - y), `step ${c.steps}`);
    }
    checked++;
  }
  assert.ok(checked > 100, `came home ${checked} times`);
  assert.ok(c.box.maxY - c.box.minY > 40, 'and kept growing');
});

test('LRRRRRLLR: a solid, growing square', () => {
  const c = lone('square');
  c.run(500_000);
  const { n, w, h } = filled(c);
  assert.ok(Math.abs(w - h) <= 2, `${w} x ${h}`);
  assert.ok(n / (w * h) > 0.95);
  assert.ok(w > 300);
});

test('RRLLLRLLLRRR: a filled triangle that moves off', () => {
  const c = lone('triangle');
  c.run(500_000);
  const { n, w, h } = filled(c);
  // A right triangle fills about half its box; the trail it leaves behind is thin.
  assert.ok(n / (w * h) > 0.15 && n / (w * h) < 0.6, `fill ${n / (w * h)}`);
  const { minX, maxX, minY, maxY } = c.box;
  const far = Math.max(-minX, maxX, -minY, maxY);
  assert.ok(far > 0.9 * Math.max(w, h), 'the shape has left the start behind');
});

test('LLRRRLRLRLLR: straight highway after about 30,000 steps, period 1968', () => {
  const c = lone('long-highway');
  c.run(45_000);
  assert.equal(c.highway.period, 1968);
  assert.ok(c.highway.onset > 25_000 && c.highway.onset < 35_000);
  assert.ok(c.highway.dx === 0 || c.highway.dy === 0, 'straight');
});

test('RR: four cells, forever', () => {
  const c = lone('loop');
  c.run(100_000);
  const { w, h } = filled(c);
  assert.deepEqual([w, h], [2, 2]);
  assert.equal(c.highway.dx, 0);
  assert.equal(c.highway.dy, 0);
});
