import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRule } from '../src/rules.js';
import { Colony } from '../src/colony.js';
import { smallestPeriod, PeriodWatch } from '../src/period.js';

const rule = (text) => parseRule(text).rule;
const lone = (text) => new Colony(rule(text), [{ x: 0, y: 0, dir: 0 }]);

test('the first steps of Langton\'s ant follow the rule by hand', () => {
  const c = lone('RL');
  c.run(1);
  // On colour 0 it turns right, paints the cell and steps right.
  assert.deepEqual(c.ants[0], { x: 1, y: 0, dir: 1 });
  assert.equal(c.grid.get(0, 0), 1);
  c.run(3);
  // Three more right turns bring it back to the start, facing up.
  assert.deepEqual(c.ants[0], { x: 0, y: 0, dir: 0 });
  c.run(1);
  // Now it stands on colour 1, turns left and repaints it 0.
  assert.deepEqual(c.ants[0], { x: -1, y: 0, dir: 3 });
  assert.equal(c.grid.get(0, 0), 0);
});

test('Langton\'s ant builds its highway at step 9977 with period 104', () => {
  const c = lone('RL');
  c.run(12288);
  assert.deepEqual(c.highway, { period: 104, dx: -2, dy: 2, onset: 9977, onsetExact: true });
});

test('the highway keeps going after it is found', () => {
  const c = lone('RL');
  c.run(9977 + 104 * 50);
  const a = { ...c.ants[0] };
  c.run(104 * 10);
  assert.deepEqual([c.ants[0].x - a.x, c.ants[0].y - a.y], [-20, 20]);
});

test('the painted count matches a census of the grid', () => {
  for (const text of ['RL', 'LLRR', 'RRLLLRLLLRRR']) {
    const c = lone(text);
    c.run(20000);
    const counts = c.grid.census(c.rule.colors);
    assert.equal(c.painted, counts.reduce((a, b) => a + b) - counts[0], text);
  }
});

test('a mirrored rule draws the mirror image', () => {
  const a = lone('RLR');
  const b = lone('LRL');
  a.run(30000);
  b.run(30000);
  for (let y = -40; y <= 40; y++) {
    for (let x = -40; x <= 40; x++) assert.equal(a.grid.get(x, y), b.grid.get(-x, y));
  }
});

test('RR turns in a two by two loop forever', () => {
  const c = lone('RR');
  c.run(4096);
  assert.deepEqual(c.highway, { period: 8, dx: 0, dy: 0, onset: 0, onsetExact: true });
});

test('several ants step in turn on the shared grid', () => {
  const c = new Colony(rule('RL'), [{ x: 0, y: 0, dir: 0 }, { x: 0, y: 0, dir: 2 }]);
  c.run(1);
  // The first paints the cell; the second then reads colour 1 and turns left.
  assert.deepEqual(c.ants, [{ x: 1, y: 0, dir: 1 }, { x: 1, y: 0, dir: 1 }]);
  assert.equal(c.grid.get(0, 0), 0);
  assert.equal(c.watch, null);
});

test('reset returns to the starting ants on an empty grid', () => {
  const c = lone('LLRR');
  c.run(5000);
  c.reset();
  assert.equal(c.steps, 0);
  assert.deepEqual(c.ants, [{ x: 0, y: 0, dir: 0 }]);
  assert.deepEqual(c.grid.census(4).slice(1), [0, 0, 0]);
});

test('smallest period of a string', () => {
  const s = Int32Array.from('xyzabcabcabcab', (ch) => ch.charCodeAt(0));
  assert.equal(smallestPeriod(s, 3, 11), 3);
  assert.equal(smallestPeriod(s, 0, 14), 14);
  assert.equal(smallestPeriod(Int32Array.of(5, 5, 5, 5), 0, 4), 1);
});

test('the watch needs enough repeats before it reports', () => {
  const w = new PeriodWatch(64);
  for (let i = 0; i < 30; i++) w.push(i < 20 ? 100 + i : i % 5, i, 0);
  assert.equal(w.detect([16], 3), null, 'noise still inside the window');
  for (let i = 30; i < 100; i++) w.push(i % 5, i, 0);
  const found = w.detect([16], 3);
  assert.equal(found.period, 5);
  assert.equal(found.dx, 5);
  assert.equal(found.onset, 36);
  assert.equal(found.onsetExact, false, 'the start at step 20 fell out of the 64-step memory');
  assert.equal(w.detect([128]), null, 'a tail longer than the memory is skipped');
});

test('a hexagonal ant walks the six axial directions', () => {
  // Always turning 60° right, the ant goes round a hexagon of six cells.
  const c = new Colony(parseRule('R1R1', 'hex').rule, [{ x: 0, y: 0, dir: 5 }]);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    c.run(1);
    seen.push([c.ants[0].x, c.ants[0].y]);
  }
  assert.deepEqual(seen, [[1, 0], [1, 1], [0, 2], [-1, 2], [-1, 1], [0, 0]]);
  assert.equal(c.ants[0].dir, 5);
});

test('hexagonal turns wrap through all six directions', () => {
  const c = new Colony(parseRule('L1L2', 'hex').rule, [{ x: 0, y: 0, dir: 0 }]);
  c.run(1);
  assert.equal(c.ants[0].dir, 5, 'L1 from east is north-east');
  assert.deepEqual([c.ants[0].x, c.ants[0].y], [1, -1]);
  const u = new Colony(parseRule('UN', 'hex').rule, [{ x: 0, y: 0, dir: 7 }]);
  assert.equal(u.ants[0].dir, 1, 'starting directions are reduced mod 6');
  u.run(1);
  assert.equal(u.ants[0].dir, 4);
});
