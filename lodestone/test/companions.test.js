import test from 'node:test';
import assert from 'node:assert/strict';
import { companionStarts, tally, tallyWords, SPREAD } from '../src/companions.js';
import { makeSystem, regularMagnets, fate } from '../src/model.js';

test('alone is one start, a twin adds one to the right', () => {
  assert.deepEqual(companionStarts(1, 2, 'alone'), [[1, 2]]);
  assert.deepEqual(companionStarts(1, 2, 'twin'), [[1, 2], [1 + SPREAD, 2]]);
});

test('a fan puts the others evenly round a small circle', () => {
  const starts = companionStarts(0.5, -1, 'fan', 12);
  assert.equal(starts.length, 12);
  assert.deepEqual(starts[0], [0.5, -1]);
  for (const [x, y] of starts.slice(1)) {
    assert.ok(Math.abs(Math.hypot(x - 0.5, y + 1) - SPREAD) < 1e-12);
  }
  const sx = starts.slice(1).reduce((a, [x]) => a + x, 0) / 11;
  assert.ok(Math.abs(sx - 0.5) < 1e-12, 'balanced round the centre');
});

test('the tally counts catches, losses and bobs still moving', () => {
  const bobs = [
    { caught: 0, done: false }, { caught: 2, done: true }, { caught: 0, done: true },
    { caught: -1, done: true }, { caught: -1, done: false },
  ];
  assert.deepEqual(tally(bobs, 3), { caught: [2, 0, 1], lost: 1, moving: 1, total: 5 });
});

test('the tally reads as a plain list', () => {
  const names = ['orange', 'blue', 'green'];
  assert.equal(tallyWords({ caught: [5, 4, 3], lost: 0 }, names), '5 orange, 4 blue and 3 green');
  assert.equal(tallyWords({ caught: [12, 0, 0], lost: 0 }, names), '12 orange');
  assert.equal(tallyWords({ caught: [0, 2, 0], lost: 1 }, names), '2 blue and 1 not caught');
});

test('in the braided zone a fan 0.01 across splits between magnets, near a magnet it does not', () => {
  const sys = makeSystem(regularMagnets(3));
  const split = (x, y) => new Set(companionStarts(x, y, 'fan').map(([a, b]) => fate(sys, a, b).magnet)).size;
  assert.equal(split(0, 1.2), 1);
  assert.ok(split(1.6, -1) > 1, 'the start the page suggests is in the braided zone');
});

test('the README split from the default start holds: 5 orange and 7 blue', () => {
  const sys = makeSystem(regularMagnets(3));
  const bobs = companionStarts(1.6, -1, 'fan').map(([x, y]) => ({ caught: fate(sys, x, y).magnet, done: true }));
  assert.deepEqual(tally(bobs, 3).caught, [5, 7, 0]);
});
