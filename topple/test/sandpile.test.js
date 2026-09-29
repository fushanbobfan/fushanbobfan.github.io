import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPile, index, addGrains, stabilize, relax, totalGrains, isStable, setCells, THRESHOLD,
} from '../src/sandpile.js';

function allBelow(pile) {
  return pile.cells.every((h) => h < THRESHOLD);
}

test('a lone cell with four grains topples once and feeds its neighbours', () => {
  const pile = createPile(3, 3);
  addGrains(pile, index(pile, 1, 1), 4);
  const r = stabilize(pile);
  assert.equal(r.topplings, 1);
  assert.equal(r.lost, 0);
  assert.deepEqual([...pile.cells], [0, 1, 0, 1, 0, 1, 0, 1, 0]);
});

test('grains are conserved: what is on the grid plus what fell off equals what was dropped', () => {
  const pile = createPile(7, 5);
  let seed = 7;
  let dropped = 0;
  for (let k = 0; k < 400; k++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const n = 1 + (seed % 5);
    addGrains(pile, seed % pile.cells.length, n);
    dropped += n;
  }
  stabilize(pile);
  assert.ok(isStable(pile));
  assert.ok(allBelow(pile));
  assert.equal(totalGrains(pile) + pile.lost, dropped);
});

test('the final state does not depend on the order grains arrive (Abelian property)', () => {
  const drops = [];
  let seed = 99;
  for (let k = 0; k < 300; k++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    drops.push(seed % 64);
  }
  const a = createPile(8, 8);
  for (const i of drops) { addGrains(a, i); stabilize(a); }
  const b = createPile(8, 8);
  for (const i of [...drops].reverse()) addGrains(b, i);
  stabilize(b);
  assert.deepEqual([...a.cells], [...b.cells]);
  assert.equal(a.lost, b.lost);
});

test('a relax budget pauses the avalanche and resuming finishes it identically', () => {
  const whole = createPile(41, 41);
  addGrains(whole, index(whole, 20, 20), 3000);
  const full = stabilize(whole);

  const parts = createPile(41, 41);
  addGrains(parts, index(parts, 20, 20), 3000);
  let topplings = 0;
  let calls = 0;
  for (;;) {
    const r = relax(parts, 50);
    topplings += r.topplings;
    calls += 1;
    if (r.stable) break;
  }
  assert.ok(calls > 1);
  assert.deepEqual([...parts.cells], [...whole.cells]);
  assert.equal(topplings, full.topplings);
});

test('a central pile is symmetric under the eight symmetries of the square', () => {
  const n = 61;
  const pile = createPile(n, n);
  addGrains(pile, index(pile, 30, 30), 5000);
  stabilize(pile);
  assert.equal(pile.lost, 0);
  const at = (x, y) => pile.cells[index(pile, x, y)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const h = at(x, y);
      assert.equal(at(n - 1 - x, y), h);
      assert.equal(at(x, n - 1 - y), h);
      assert.equal(at(y, x), h);
    }
  }
});

test('setCells replaces the configuration and queues unstable cells', () => {
  const pile = createPile(2, 2);
  addGrains(pile, 0, 2);
  setCells(pile, [4, 0, 0, 0]);
  assert.equal(isStable(pile), false);
  stabilize(pile);
  assert.deepEqual([...pile.cells], [0, 1, 1, 0]);
  assert.equal(pile.lost, 2);
});

test('bad sizes are rejected', () => {
  assert.throws(() => createPile(0, 4), RangeError);
  assert.throws(() => createPile(3.5, 4), RangeError);
});
