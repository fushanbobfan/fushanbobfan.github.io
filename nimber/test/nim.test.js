import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMove, blocks, isWinning, legalMoves, nimSum, oddBlockSizes, winningMoves,
} from '../src/nim.js';

function searchWins(heaps, misere, memo = new Map()) {
  const key = heaps.join(',');
  if (memo.has(key)) return memo.get(key);
  let wins;
  if (heaps.every((h) => h === 0)) {
    wins = misere; // the previous player took the last stone
  } else {
    wins = legalMoves(heaps).some((m) => !searchWins(applyMove(heaps, m), misere, memo));
  }
  memo.set(key, wins);
  return wins;
}

function* positions(piles, max) {
  if (piles === 0) {
    yield [];
    return;
  }
  for (const rest of positions(piles - 1, max)) {
    for (let h = 0; h <= max; h++) yield [...rest, h];
  }
}

for (const misere of [false, true]) {
  const label = misere ? 'misère' : 'normal';
  test(`${label}: the closed-form rule agrees with exhaustive search`, () => {
    const memo = new Map();
    let checked = 0;
    for (const heaps of positions(4, 5)) {
      assert.equal(isWinning(heaps, misere), searchWins(heaps, misere, memo), heaps.join(','));
      checked++;
    }
    assert.equal(checked, 6 ** 4);
  });

  test(`${label}: winning moves are exactly the moves search approves`, () => {
    const memo = new Map();
    for (const heaps of positions(3, 6)) {
      const expected = legalMoves(heaps).filter(
        (m) => !searchWins(applyMove(heaps, m), misere, memo),
      );
      assert.deepEqual(winningMoves(heaps, misere), expected, heaps.join(','));
    }
  });
}

test('the classic 3-4-5 opening has one good move: take two from the 3', () => {
  assert.equal(nimSum([3, 4, 5]), 2);
  assert.deepEqual(winningMoves([3, 4, 5]), [{ heap: 0, to: 1 }]);
});

test('blocks are the binary digits of a pile', () => {
  assert.deepEqual(blocks(13), [8, 4, 1]);
  assert.deepEqual(blocks(0), []);
  for (let n = 1; n < 64; n++) {
    assert.equal(blocks(n).reduce((a, b) => a + b, 0), n);
  }
});

test('odd block sizes are the sizes held by an odd number of piles', () => {
  for (const heaps of positions(3, 7)) {
    const direct = [4, 2, 1].filter(
      (p) => heaps.filter((h) => blocks(h).includes(p)).length % 2 === 1,
    );
    assert.deepEqual(oddBlockSizes(heaps), direct);
  }
});

test('in a nim-sum zero position every move unbalances, otherwise one balances', () => {
  for (const heaps of positions(3, 7)) {
    const moves = legalMoves(heaps).map((m) => nimSum(applyMove(heaps, m)));
    if (nimSum(heaps) === 0) assert.ok(moves.every((s) => s !== 0));
    else assert.ok(moves.some((s) => s === 0));
  }
});

test('misère differs only in positions where every pile is at most 1', () => {
  for (const heaps of positions(4, 3)) {
    if (heaps.some((h) => h >= 2)) assert.equal(isWinning(heaps, true), isWinning(heaps, false));
  }
  assert.equal(isWinning([1, 1, 1], true), false);
  assert.equal(isWinning([1, 1], true), true);
});
