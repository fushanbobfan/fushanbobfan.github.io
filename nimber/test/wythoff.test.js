import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom } from '../src/rng.js';
import { chooseMove, createGame, playMove, turningPoints } from '../src/turns.js';
import {
  coldPosition, dealQueen, isCold, isQueenMove, PHI, queenMoves, queenNimbers, queenRules, shadowOf, sieveColdSquares,
} from '../src/wythoff.js';

// OEIS A004481, the table of Wythoff nimbers read by antidiagonals.
const ANTIDIAGONALS = [0, 1, 1, 2, 2, 2, 3, 0, 0, 3, 4, 4, 1, 4, 4, 5, 5, 5, 5, 5, 5, 6, 3, 3, 6, 3, 3, 6, 7, 7, 4, 2, 2, 4, 7, 7, 8, 8, 8, 0, 7, 0, 8, 8, 8, 9, 6, 6, 1, 6, 6, 1, 6, 6, 9, 10, 10, 7, 9, 9, 8, 9, 9, 7, 10, 10, 11, 11, 11, 10, 0, 10, 10, 0, 10, 11, 11, 11, 12, 9, 9, 12, 1, 1, 3, 1, 1, 12, 9, 9, 12];

const nimbers = queenNimbers(256);

test('nimbers match the published table', () => {
  const read = [];
  for (let sum = 0; read.length < ANTIDIAGONALS.length; sum++) {
    for (let a = 0; a <= sum; a++) read.push(nimbers[a][sum - a]);
  }
  assert.deepEqual(read.slice(0, ANTIDIAGONALS.length), ANTIDIAGONALS);
});

test('the golden-ratio formula finds exactly the squares worth 0', () => {
  for (let a = 0; a < 256; a++) {
    for (let b = 0; b < 256; b++) {
      assert.equal(isCold(a, b), nimbers[a][b] === 0, `${a},${b}`);
    }
  }
});

test('the sieve finds the same squares as the formula', () => {
  for (const size of [8, 34, 200]) {
    const found = sieveColdSquares(size);
    for (const [a, b] of found) assert.ok(isCold(a, b), `${a},${b}`);
    let cold = 0;
    for (let a = 0; a < size; a++) {
      for (let b = 0; b < size; b++) if (isCold(a, b)) cold++;
    }
    assert.equal(found.length, cold);
  }
});

test('the sieve lists each square after everything that can reach it', () => {
  const found = sieveColdSquares(34);
  for (let steps = 0; steps < found.length; steps++) {
    const shade = shadowOf(found, steps);
    const [a, b] = found[steps];
    assert.equal(shade(a, b), false);
    for (const m of queenMoves([a, b])) {
      if (!found.slice(0, steps).some(([x, y]) => x === m.a && y === m.b)) {
        assert.ok(shade(m.a, m.b), `${a},${b} -> ${m.a},${m.b} at step ${steps}`);
      }
    }
  }
});

test('the two coordinates of cold squares use every positive whole number once', () => {
  const seen = new Map();
  for (let k = 1; k < 2000; k++) {
    for (const n of coldPosition(k)) seen.set(n, (seen.get(n) ?? 0) + 1);
    const [a, b] = coldPosition(k);
    assert.equal(b - a, k);
    assert.equal(b, Math.floor(k * PHI * PHI));
  }
  for (let n = 1; n < 2000; n++) assert.equal(seen.get(n), 1, `n = ${n}`);
});

test('each column, row and diagonal holds at most one cold square', () => {
  const found = sieveColdSquares(200);
  for (const pick of [([a]) => a, ([, b]) => b, ([a, b]) => a - b]) {
    assert.equal(new Set(found.map(pick)).size, found.length);
  }
});

test('queen moves stay in line and head for the corner', () => {
  const moves = queenMoves([2, 3]);
  assert.equal(moves.length, 2 + 3 + 2);
  for (const { a, b } of moves) assert.ok(isQueenMove([2, 3], a, b));
  assert.equal(isQueenMove([2, 3], 2, 3), false);
  assert.equal(isQueenMove([2, 3], 3, 3), false);
  assert.equal(isQueenMove([2, 3], 1, 1), false);
  assert.equal(isQueenMove([2, 3], 0, 1), true);
  let count = 0;
  for (let a = 0; a < 6; a++) {
    for (let b = 0; b < 6; b++) if (isQueenMove([2, 3], a, b)) count++;
  }
  assert.equal(count, moves.length);
});

test('the computer wins from every hot square against random play', () => {
  const rules = queenRules();
  const rng = seededRandom(9);
  for (let i = 0; i < 300; i++) {
    let game = createGame(rules, dealQueen(rng, { size: 8 + (i % 17), kind: 'winning' }), 'computer');
    while (!game.winner) {
      const moves = rules.legalMoves(game.position);
      const move = game.turn === 'computer'
        ? chooseMove(rules, game.position, { rng })
        : moves[Math.floor(rng() * moves.length)];
      game = playMove(game, move);
    }
    assert.equal(game.winner, 'computer');
    assert.equal(turningPoints(game).length, 0);
  }
});

test('a dealt queen starts where the game asks', () => {
  const rng = seededRandom(1);
  for (const size of [8, 16, 24]) {
    for (const kind of ['winning', 'losing']) {
      for (let i = 0; i < 50; i++) {
        const [a, b] = dealQueen(rng, { size, kind });
        assert.ok(a >= size / 2 - 1 && a < size && b >= size / 2 - 1 && b < size);
        assert.equal(isCold(a, b), kind === 'losing');
      }
    }
  }
});
