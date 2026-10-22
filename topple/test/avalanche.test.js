import test from 'node:test';
import assert from 'node:assert/strict';
import { createPile, index, setCells, totalGrains } from '../src/sandpile.js';
import { createTracker, dropGrain, siteRandom } from '../src/avalanche.js';

test('a grain on a stable cell causes no avalanche', () => {
  const pile = createPile(5, 5);
  const t = createTracker(pile);
  assert.deepEqual(dropGrain(pile, index(pile, 2, 2), t), { size: 0, area: 0, lost: 0 });
});

test('a grain on the all-threes pile of a 3x3 grid sets off the whole grid', () => {
  const pile = createPile(3, 3);
  setCells(pile, new Array(9).fill(3));
  const t = createTracker(pile);
  const r = dropGrain(pile, index(pile, 1, 1), t);
  assert.equal(r.area, 9);
  assert.ok(r.size >= r.area);
  assert.equal(totalGrains(pile) + r.lost, 28);
});

test('area counts distinct cells, and each drop starts a fresh count', () => {
  const pile = createPile(9, 9);
  const t = createTracker(pile);
  const rand = siteRandom(3);
  let sizeSum = 0;
  for (let k = 0; k < 2000; k++) {
    const r = dropGrain(pile, rand(pile.cells.length), t);
    assert.ok(r.area <= r.size);
    assert.ok(r.area <= 81);
    sizeSum += r.size;
  }
  assert.ok(sizeSum > 0);
});

test('the site picker is reproducible and stays in range', () => {
  const a = siteRandom(42);
  const b = siteRandom(42);
  const counts = new Array(10).fill(0);
  for (let k = 0; k < 5000; k++) {
    const v = a(10);
    assert.equal(v, b(10));
    assert.ok(v >= 0 && v < 10);
    counts[v] += 1;
  }
  for (const c of counts) assert.ok(c > 400 && c < 600);
});
