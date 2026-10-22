import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHI, SEEDS, assemble, countKinds, grow } from '../src/tiling.js';
import { MAJOR, halfCounts, patchRatio, summarise } from '../src/stats.js';

test('the counting rule matches the triangles actually grown', () => {
  for (const id of Object.keys(SEEDS)) {
    for (let g = 0; g <= 7; g++) {
      const grown = countKinds(grow(id, g));
      const counted = halfCounts(id, g);
      for (const k of Object.keys(counted)) assert.equal(counted[k], grown[k] || 0, `${id} gen ${g} ${k}`);
    }
  }
});

test('the counts are Fibonacci numbers', () => {
  const fib = [1, 1];
  while (fib.length < 30) fib.push(fib.at(-1) + fib.at(-2));
  const c = halfCounts('p2-sun', 6);
  // Ten half kites; each generation multiplies by [[2,1],[1,1]], whose
  // powers hold every other Fibonacci number.
  assert.equal(c.kite, 10 * fib[12]);
  assert.equal(c.dart, 10 * fib[11]);
});

test('the patch ratio gets closer to the golden ratio every generation', () => {
  let prev = null;
  for (let g = 1; g <= 12; g++) {
    const r = patchRatio('p3-sun', g);
    const err = Math.abs(r - PHI);
    if (prev !== null) assert.ok(err < prev, `generation ${g}`);
    prev = err;
  }
  assert.ok(prev < 1e-6);
});

test('the summary counts whole and partial tiles separately', () => {
  const p = assemble(grow('p2-sun', 5), 'p2');
  const s = summarise(p, 'p2');
  assert.deepEqual([s.major, s.minor], MAJOR.p2);
  assert.equal(s.whole.kite + s.whole.dart, p.tiles.length);
  assert.equal(s.partial.kite + s.partial.dart, p.halves.length);
  assert.ok(Math.abs(s.error) < 0.05);
  assert.equal(summarise({ tiles: [] }, 'p3').ratio, null);
});
