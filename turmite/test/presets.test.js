import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRule } from '../src/rules.js';
import { Colony } from '../src/colony.js';
import { PRESETS, presetById } from '../src/presets.js';

const lone = (id) => {
  const p = presetById(id);
  return new Colony(parseRule(p.rule, p.lattice).rule, [{ x: 0, y: 0, dir: 0 }]);
};

const filled = (c) => {
  const { minX, maxX, minY, maxY } = c.box;
  let n = 0;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (c.grid.get(x, y)) n++;
  return { n, w: maxX - minX + 1, h: maxY - minY + 1 };
};

test('every preset parses, has a unique id and a note', () => {
  const ids = new Set();
  for (const p of PRESETS) {
    assert.ok(parseRule(p.rule, p.lattice).ok, p.id);
    assert.ok(['square', 'hex'].includes(p.lattice), p.id);
    assert.ok(p.note.length > 20, p.id);
    ids.add(p.id);
  }
  assert.equal(ids.size, PRESETS.length);
  assert.equal(presetById('nope'), null);
});

test("Langton's ant: highway at step 9977, period 104", () => {
  const c = lone('langton');
  c.run(30_000);
  assert.ok(c.highway.escaped);
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
  c.run(70_000);
  assert.ok(c.highway.escaped);
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

// Hexagonal mirror: (q, r) -> (-q - r - 1, r) reflects across the vertical
// line through the edge between the first cell and its west neighbour.
function homeMirror(id, steps) {
  const c = lone(id);
  let home = 0;
  for (let s = 0; s < steps; s++) {
    c.run(1);
    const a = c.ants[0];
    if (a.x !== 0 || a.y !== 0) continue;
    assert.equal(a.dir, 0, `${id} home facing east at step ${c.steps}`);
    const { minX, maxX, minY, maxY } = c.box;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX - 2; x <= maxX + 2; x++) {
        assert.equal(c.grid.get(x, y), c.grid.get(-x - y - 1, y), `${id} step ${c.steps}`);
      }
    }
    home++;
  }
  return home;
}

test('L1R1 on hexagons: mirror image at every return home, no highway', () => {
  assert.ok(homeMirror('hex-langton', 100_000) > 500);
  const c = lone('hex-langton');
  c.run(3_000_000);
  assert.equal(c.highway, null);
});

test('L1L1R1R1 on hexagons: mirror image at every return home', () => {
  assert.ok(homeMirror('hex-mirror', 100_000) > 500);
});

test('L2R2 on hexagons: a two-cell track from the start, period 8', () => {
  const c = lone('hex-track');
  c.run(16384);
  assert.ok(c.highway.escaped);
  assert.equal(c.highway.period, 8);
  assert.ok(c.highway.onset <= 2);
  const { minX, maxX } = c.box;
  assert.equal(maxX - minX + 1, 2, 'two cells wide');
});

test('L1L2NUL2L1R2 on hexagons: from step 101,404 it laps its rim, every edge the same 698-step pattern turned 60°', () => {
  const c = lone('hex-rim');
  const seen = new Map();
  let first = null;
  while (c.steps < 1_000_000) {
    c.run(4096);
    const h = c.highway;
    if (!h) continue;
    first ??= h.onset;
    assert.equal(h.period, 698);
    assert.equal(h.escaped, false, 'never breaks away');
    seen.set(`${h.dx},${h.dy}`, true);
  }
  assert.equal(first, 101_404);
  // The six rotations of (-21, 3) by 60°: (q, r) -> (-r, q + r).
  const rotations = [];
  let [q, r] = [-21, 3];
  for (let k = 0; k < 6; k++) {
    rotations.push(`${q},${r}`);
    [q, r] = [-r, q + r];
  }
  assert.deepEqual([...seen.keys()].sort(), rotations.sort());
  const { minX, maxX, minY, maxY } = c.box;
  assert.ok(Math.abs(maxX - minX - (maxY - minY)) <= 21, 'as wide as it is tall');
});
