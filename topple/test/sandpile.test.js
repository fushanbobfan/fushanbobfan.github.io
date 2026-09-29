import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPile, index, addGrains, stabilize, relax, sweep, totalGrains, isStable, setCells, THRESHOLD,
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

test('sweeping reaches the same stable pile as the queue, in pieces or at once', () => {
  const a = createPile(45, 45);
  const b = createPile(45, 45);
  addGrains(a, index(a, 22, 22), 4000);
  addGrains(b, index(b, 22, 22), 4000);
  addGrains(a, index(a, 3, 40), 77);
  addGrains(b, index(b, 3, 40), 77);
  const ra = stabilize(a);
  let rounds = 0;
  let passes = 0;
  let topplings = 0;
  for (;;) {
    const r = sweep(b, 25);
    rounds += 1;
    passes += r.passes;
    topplings += r.topplings;
    assert.equal(isStable(b), r.stable);
    if (r.stable) break;
  }
  assert.ok(rounds > 1);
  assert.deepEqual([...b.cells], [...a.cells]);
  assert.equal(b.lost, a.lost);
  assert.equal(topplings, ra.topplings);
  assert.ok(passes < ra.topplings);
});

test('after a partial sweep the queue can finish the job', () => {
  const a = createPile(31, 31);
  const b = createPile(31, 31);
  addGrains(a, index(a, 15, 15), 1500);
  addGrains(b, index(b, 15, 15), 1500);
  stabilize(a);
  sweep(b, 3);
  assert.equal(isStable(b), false);
  stabilize(b);
  assert.deepEqual([...b.cells], [...a.cells]);
});

test('the odometer counts every toppling and agrees between queue and sweep', () => {
  const a = createPile(35, 35);
  const b = createPile(35, 35);
  addGrains(a, index(a, 17, 17), 2500);
  addGrains(b, index(b, 17, 17), 2500);
  const ra = stabilize(a);
  sweep(b);
  assert.deepEqual([...a.odometer], [...b.odometer]);
  assert.equal(a.odometer.reduce((s, v) => s + v, 0), ra.topplings);
  const c = a.odometer[index(a, 17, 17)];
  assert.ok(a.odometer.every((v) => v <= c), 'the centre fires most');
});

test('the odometer solves the discrete Poisson equation of the final pile', () => {
  // Grains in = 4 * own topplings - neighbours' topplings + final height.
  const n = 21;
  const pile = createPile(n, n);
  const start = new Uint32Array(n * n);
  start[index(pile, 10, 10)] = 900;
  start[index(pile, 4, 15)] = 40;
  setCells(pile, start);
  stabilize(pile);
  const u = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : pile.odometer[index(pile, x, y)]);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = index(pile, x, y);
      const lap = 4 * u(x, y) - u(x - 1, y) - u(x + 1, y) - u(x, y - 1) - u(x, y + 1);
      assert.equal(start[i] - lap, pile.cells[i]);
    }
  }
});

test('clearing resets the odometer', () => {
  const pile = createPile(3, 3);
  addGrains(pile, 4, 8);
  stabilize(pile);
  assert.ok(pile.odometer[4] > 0);
  setCells(pile, new Uint32Array(9));
  assert.ok(pile.odometer.every((v) => v === 0));
});
