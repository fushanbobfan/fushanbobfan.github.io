import test from 'node:test';
import assert from 'node:assert/strict';
import { provePeriod, tableFor } from '../src/octal.js';
import { cellToN, exceptionalCells, wallLayout } from '../src/wall.js';

test('the wall shows enough lines to reach past each pre-period', () => {
  for (const [key, code] of [['kayles', '0.77'], ['chess', '0.137'], ['dawson', '0.07']]) {
    const table = tableFor(key);
    const proof = provePeriod(code, table);
    const layout = wallLayout(900, proof.period, table.length);
    assert.ok(layout.shown > proof.start + 3 * proof.period, key);
  }
});

test('cells read left to right from a run of 0 and stop at the last shown', () => {
  const layout = { columns: 12, shown: 30 };
  assert.equal(cellToN(0, 0, layout), 0);
  assert.equal(cellToN(5, 2, layout), 29);
  assert.equal(cellToN(11, 2, layout), null);
  assert.equal(cellToN(12, 0, layout), null);
  assert.equal(cellToN(-1, 0, layout), null);
});

test('cells stay usable at the narrowest and widest wrap', () => {
  assert.equal(wallLayout(343, 60, 1501).cell, 5);
  assert.equal(wallLayout(1000, 1, 1501).cell, 34);
});

// OEIS A002186 and A002187 list these exceptions to the repeating pattern.
test('the marked exceptions are the published ones', () => {
  assert.deepEqual(
    exceptionalCells(tableFor('kayles'), provePeriod('0.77', tableFor('kayles'))),
    [0, 3, 6, 9, 11, 15, 18, 21, 22, 28, 34, 39, 57, 70],
  );
  assert.deepEqual(
    exceptionalCells(tableFor('chess'), provePeriod('0.137', tableFor('chess'))),
    [0, 14, 16, 17, 31, 34, 51],
  );
});

test('an unproved game marks nothing', () => {
  assert.deepEqual(exceptionalCells(tableFor('officers'), null), []);
});
