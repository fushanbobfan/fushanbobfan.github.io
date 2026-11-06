import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshRow, GAMES, gapMove, grundyTable, parseCode, pinMove, provePeriod, rowRules, rowValue, runMoves, runsOf, tableFor,
} from '../src/octal.js';
import { chooseMove, createGame, playMove, turningPoints } from '../src/turns.js';
import { seededRandom } from '../src/rng.js';

// OEIS A002186, Sprague-Grundy values for Kayles.
const KAYLES = [0, 1, 2, 3, 1, 4, 3, 2, 1, 4, 2, 6, 4, 1, 2, 7, 1, 4, 3, 2, 1, 4, 6, 7, 4, 1, 2, 8, 5, 4, 7, 2, 1, 8, 6, 7, 4, 1, 2, 3, 1, 4, 7, 2, 1, 8, 2, 7, 4, 1, 2, 8, 1, 4, 7, 2, 1, 4, 2, 7, 4, 1, 2, 8, 1, 4, 7, 2, 1, 8, 6, 7, 4, 1, 2, 8, 1, 4, 7, 2, 1, 8, 2, 7, 4, 1, 2, 8, 1, 4, 7, 2, 1, 8, 2, 7, 4, 1, 2, 8, 1, 4, 7, 2, 1];
// OEIS A002187, Sprague-Grundy values for Dawson's Chess.
const CHESS = [0, 1, 1, 2, 0, 3, 1, 1, 0, 3, 3, 2, 2, 4, 0, 5, 2, 2, 3, 3, 0, 1, 1, 3, 0, 2, 1, 1, 0, 4, 5, 2, 7, 4, 0, 1, 1, 2, 0, 3, 1, 1, 0, 3, 3, 2, 2, 4, 4, 5, 5, 2, 3, 3, 0, 1, 1, 3, 0, 2, 1, 1, 0, 4, 5, 3, 7, 4, 8, 1, 1, 2, 0, 3, 1, 1, 0, 3, 3, 2, 2, 4, 4, 5, 5, 9, 3, 3, 0, 1, 1, 3, 0, 2, 1, 1, 0, 4, 5, 3, 7, 4, 8, 1, 1, 2, 0, 3, 1, 1, 0, 3, 3, 2, 2, 4, 4, 5, 5, 9, 3, 3, 0, 1, 1, 3, 0, 2, 1, 1, 0, 4];

test('codes parse into digits by number of pins taken', () => {
  assert.deepEqual(parseCode('0.137'), [0, 1, 3, 7]);
  assert.throws(() => parseCode('0.8'));
  assert.throws(() => parseCode('137'));
});

test('the digit bits decide which runs may remain', () => {
  const chess = parseCode('0.137');
  assert.deepEqual(runMoves(chess, 1), [{ left: 0, take: 1, right: 0 }]);
  assert.deepEqual(runMoves(chess, 3).map((m) => m.take), [2, 2, 3]);
  const officers = parseCode('0.6');
  assert.deepEqual(runMoves(officers, 1), []);
  assert.equal(runMoves(officers, 3).length, 3);
});

test('published Kayles and Dawson values come out of the rule', () => {
  assert.deepEqual([...tableFor('kayles').slice(0, KAYLES.length)], KAYLES);
  assert.deepEqual([...tableFor('chess').slice(0, CHESS.length)], CHESS);
  // OEIS: octal game .07 has the values of Dawson's Chess shifted by one.
  assert.deepEqual([...tableFor('dawson').slice(1, CHESS.length + 1)], CHESS);
  assert.equal(tableFor('dawson')[0], 0);
});

test('the first Officers values agree with the published table', () => {
  assert.equal([...tableFor('officers').slice(0, 16)].join(''), '0012012312340342');
});

test('the Grundy recurrence agrees with a direct mex over every move', () => {
  for (const key of Object.keys(GAMES)) {
    const digits = parseCode(GAMES[key].code);
    const g = tableFor(key);
    for (let n = 0; n <= 80; n++) {
      const reached = new Set(runMoves(digits, n).map((m) => g[m.left] ^ g[m.right]));
      let mex = 0;
      while (reached.has(mex)) mex++;
      assert.equal(g[n], mex, `${key} ${n}`);
    }
  }
});

test('the periods the literature gives are proved from the table', () => {
  assert.deepEqual(provePeriod('0.77', tableFor('kayles')), { start: 71, period: 12, checkedTo: 1500 });
  assert.deepEqual(provePeriod('0.137', tableFor('chess')), { start: 52, period: 34, checkedTo: 1500 });
  assert.deepEqual(provePeriod('0.07', tableFor('dawson')), { start: 53, period: 34, checkedTo: 1500 });
  assert.equal(provePeriod('0.6', tableFor('officers')), null);
});

test('a short table proves nothing rather than something false', () => {
  assert.equal(provePeriod('0.77', grundyTable('0.77', 120)), null);
  const enough = provePeriod('0.77', grundyTable('0.77', 300));
  assert.equal(enough.period, 12);
  assert.equal(enough.start, 71);
});

function searchWins(rules, pins, memo) {
  const key = pins.map((p) => (p ? 1 : 0)).join('');
  if (memo.has(key)) return memo.get(key);
  const wins = rules.legalMoves(pins).some((m) => !searchWins(rules, rules.applyMove(pins, m), memo));
  memo.set(key, wins);
  return wins;
}

for (const key of Object.keys(GAMES)) {
  const rules = rowRules(key);

  test(`${key}: nimbers call every position of a 12-pin row like exhaustive search`, () => {
    const memo = new Map();
    for (let mask = 0; mask < 1 << 12; mask++) {
      const pins = Array.from({ length: 12 }, (_, i) => Boolean(mask & (1 << i)));
      assert.equal(rules.isWinning(pins), searchWins(rules, pins, memo), mask.toString(2));
    }
  });

  test(`${key}: every legal move can be made by clicking`, () => {
    for (let mask = 0; mask < 1 << 9; mask++) {
      const pins = Array.from({ length: 9 }, (_, i) => Boolean(mask & (1 << i)));
      const clicks = new Set();
      for (let i = 0; i < 9; i++) {
        for (const m of [pinMove(key, pins, i), i < 8 ? gapMove(key, pins, i) : null]) {
          if (m) clicks.add(`${m.start}+${m.take}`);
        }
      }
      const legal = new Set(rules.legalMoves(pins).map((m) => `${m.start}+${m.take}`));
      assert.deepEqual([...clicks].sort(), [...legal].sort(), `mask ${mask.toString(2)}`);
    }
  });

  test(`${key}: the computer wins every won row against random play`, () => {
    const rng = seededRandom(key.length * 31);
    let won = 0;
    for (let length = 1; length <= 36; length++) {
      const start = freshRow(length);
      if (!rules.isWinning(start) || !rules.legalMoves(start).length) continue;
      for (let i = 0; i < 6; i++) {
        let game = createGame(rules, start, 'computer');
        while (!game.winner) {
          const moves = rules.legalMoves(game.position);
          const move = game.turn === 'computer'
            ? chooseMove(rules, game.position, { rng })
            : moves[Math.floor(rng() * moves.length)];
          game = playMove(game, move);
        }
        assert.equal(game.winner, 'computer');
        assert.equal(turningPoints(game).length, 0);
        won++;
      }
    }
    assert.ok(won > 60, `${won} games`);
  });
}

test('runs are the unbroken stretches of standing pins', () => {
  assert.deepEqual(runsOf([true, true, false, true, false, false, true]), [
    { start: 0, length: 2 }, { start: 3, length: 1 }, { start: 6, length: 1 },
  ]);
  assert.deepEqual(runsOf([false]), []);
});

test('a row is worth the nim-sum of its runs', () => {
  const g = tableFor('kayles');
  assert.equal(rowValue([true, true, false, true, true, true], g), g[2] ^ g[3]);
});

test('clicks in Kayles and Dawson games mean what the page says', () => {
  const row = freshRow(5);
  assert.deepEqual(pinMove('kayles', row, 2), { start: 2, take: 1 });
  assert.deepEqual(gapMove('kayles', row, 1), { start: 1, take: 2 });
  assert.equal(pinMove('dawson', row, 2), null);
  assert.deepEqual(gapMove('dawson', row, 3), { start: 3, take: 2 });
  assert.deepEqual(pinMove('chess', row, 2), { start: 1, take: 3 });
  assert.deepEqual(pinMove('chess', row, 0), { start: 0, take: 2 });
  assert.equal(gapMove('chess', row, 1), null);
  assert.equal(pinMove('officers', [true, false, true, true], 0), null);
  assert.deepEqual(pinMove('officers', [true, false, true, true], 2), { start: 2, take: 1 });
});

test('the opening player wins Kayles at every length, as mirroring predicts', () => {
  const g = tableFor('kayles');
  for (let n = 1; n < g.length; n++) assert.notEqual(g[n], 0, `n = ${n}`);
});
