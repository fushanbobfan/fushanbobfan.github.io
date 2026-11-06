import test from 'node:test';
import assert from 'node:assert/strict';
import { computerMove, createMatch, deal, playMove, takeBack, turningPoints } from '../src/match.js';
import { isWinning, legalMoves } from '../src/nim.js';
import { seededRandom } from '../src/rng.js';

function playout(heaps, misere, first, you, computer) {
  let match = createMatch({ heaps, misere, first });
  while (!match.winner) {
    const move = match.turn === 'you' ? you(match.heaps) : computer(match.heaps);
    match = playMove(match, move);
  }
  return match;
}

for (const misere of [false, true]) {
  const label = misere ? 'misère' : 'normal';

  test(`${label}: the perfect computer never loses a position it holds as won`, () => {
    const rng = seededRandom(7);
    let games = 0;
    for (let i = 0; i < 400; i++) {
      const heaps = deal(rng, { piles: 2 + (i % 4), largest: 3 + (i % 11), kind: 'winning', misere });
      const random = (h) => {
        const moves = legalMoves(h);
        return moves[Math.floor(rng() * moves.length)];
      };
      const match = playout(heaps, misere, 'computer', random, (h) => computerMove(h, { misere, rng }));
      assert.equal(match.winner, 'computer', heaps.join(','));
      games++;
    }
    assert.equal(games, 400);
  });

  test(`${label}: perfect play beats the perfect computer from a position lost for it`, () => {
    const rng = seededRandom(11);
    for (let i = 0; i < 200; i++) {
      const heaps = deal(rng, { piles: 2 + (i % 4), largest: 3 + (i % 11), kind: 'losing', misere });
      const perfect = (h) => computerMove(h, { misere, rng });
      const match = playout(heaps, misere, 'computer', perfect, perfect);
      assert.equal(match.winner, 'you', heaps.join(','));
      assert.equal(turningPoints(match).length, 0);
    }
  });
}

test('taking the last stone wins in normal play and loses in misère', () => {
  assert.equal(playMove(createMatch({ heaps: [2] }), { heap: 0, to: 0 }).winner, 'you');
  assert.equal(playMove(createMatch({ heaps: [2], misere: true }), { heap: 0, to: 0 }).winner, 'computer');
});

test('illegal moves are refused', () => {
  const match = createMatch({ heaps: [3, 0] });
  assert.throws(() => playMove(match, { heap: 0, to: 3 }));
  assert.throws(() => playMove(match, { heap: 1, to: 0 }));
  assert.throws(() => playMove(match, { heap: 5, to: 0 }));
  assert.throws(() => playMove(match, { heap: 0, to: -1 }));
  assert.throws(() => createMatch({ heaps: [0, 0] }));
});

test('taking back rewinds your move and the reply to it', () => {
  let match = createMatch({ heaps: [3, 4, 5] });
  match = playMove(match, { heap: 0, to: 1 });
  match = playMove(match, { heap: 1, to: 0 });
  const back = takeBack(match);
  assert.deepEqual(back.heaps, [3, 4, 5]);
  assert.equal(back.turn, 'you');
  assert.equal(back.history.length, 0);
});

test('taking back when the computer opened keeps its opening move', () => {
  let match = createMatch({ heaps: [3, 4, 5], first: 'computer' });
  match = playMove(match, { heap: 0, to: 1 });
  match = playMove(match, { heap: 1, to: 2 });
  const back = takeBack(match);
  assert.deepEqual(back.heaps, [1, 4, 5]);
  assert.equal(back.turn, 'you');
  assert.equal(takeBack(back), back);
});

test('a finished game can be taken back', () => {
  let match = createMatch({ heaps: [2] });
  match = playMove(match, { heap: 0, to: 0 });
  assert.equal(takeBack(match).winner, null);
});

test('a weak computer slips, and those slips are the turning points', () => {
  const rng = seededRandom(3);
  let slips = 0;
  for (let i = 0; i < 300; i++) {
    const move = computerMove([3, 4, 5], { skill: 0, rng });
    if (isWinning([3, 4, 5].map((h, j) => (j === move.heap ? move.to : h)))) slips++;
  }
  assert.equal(slips, 300);
  let match = createMatch({ heaps: [3, 4, 5], first: 'computer' });
  match = playMove(match, { heap: 2, to: 4 });
  assert.equal(turningPoints(match).length, 1);
  assert.equal(turningPoints(match)[0].who, 'computer');
});

test('a dealt position has the requested outcome and shape', () => {
  const rng = seededRandom(5);
  for (const misere of [false, true]) {
    for (const piles of [2, 3, 4, 5, 6]) {
      for (const largest of [3, 7, 15]) {
        for (const kind of ['winning', 'losing']) {
          const heaps = deal(rng, { piles, largest, kind, misere });
          assert.equal(heaps.length, piles);
          assert.ok(heaps.every((h) => h >= 1 && h <= largest));
          assert.equal(isWinning(heaps, misere), kind === 'winning');
        }
      }
    }
  }
});
