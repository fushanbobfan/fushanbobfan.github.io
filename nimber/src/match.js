// One game of Nim between "you" and "computer", kept as plain data so a whole
// game can be played in a test exactly as the page plays it.

import { applyMove, isWinning, judgeMove, legalMoves, winningMoves } from './nim.js';

const other = (who) => (who === 'you' ? 'computer' : 'you');

export function createMatch({ heaps, misere = false, first = 'you' }) {
  if (!heaps.some((h) => h > 0)) throw new Error('a game needs at least one stone');
  return { start: heaps.slice(), heaps: heaps.slice(), misere, first, turn: first, history: [], winner: null };
}

export function playMove(match, move) {
  if (match.winner) throw new Error('the game is over');
  const from = match.heaps[move.heap];
  if (!Number.isInteger(move.to) || from === undefined || move.to < 0 || move.to >= from) {
    throw new Error('illegal move');
  }
  const heaps = applyMove(match.heaps, move);
  const entry = {
    who: match.turn,
    heap: move.heap,
    from,
    to: move.to,
    quality: judgeMove(match.heaps, move, match.misere),
  };
  const finished = heaps.every((h) => h === 0);
  return {
    ...match,
    heaps,
    turn: other(match.turn),
    history: [...match.history, entry],
    winner: finished ? (match.misere ? other(match.turn) : match.turn) : null,
  };
}

// Rewinds to your previous decision: your last move and any reply to it.
export function takeBack(match) {
  let history = match.history.slice();
  while (history.length && history[history.length - 1].who !== 'you') history.pop();
  if (!history.length) return match;
  history.pop();
  let rewound = createMatch({ heaps: match.start, misere: match.misere, first: match.first });
  for (const { heap, to } of history) rewound = playMove(rewound, { heap, to });
  return rewound;
}

// skill is the chance of playing a winning move when one exists. A lost position
// has none, so the computer takes one stone and waits for you to slip.
export function computerMove(heaps, { misere = false, skill = 1, rng = Math.random } = {}) {
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const good = winningMoves(heaps, misere);
  if (good.length && rng() < skill) return pick(good);
  const bites = legalMoves(heaps).filter((m) => heaps[m.heap] - m.to === 1);
  const stalling = bites.filter((m) => isWinning(applyMove(heaps, m), misere));
  return pick(stalling.length ? stalling : bites);
}

export function deal(rng, { piles, largest, kind = 'any', misere = false }) {
  for (let tries = 0; tries < 20000; tries++) {
    const heaps = Array.from({ length: piles }, () => 1 + Math.floor(rng() * largest));
    const wins = isWinning(heaps, misere);
    if (kind === 'any' || (kind === 'winning') === wins) return heaps;
  }
  throw new Error('no such position');
}

// The moves where the game changed hands: a player holding a won game let it go.
export function turningPoints(match) {
  return match.history.filter((entry) => entry.quality === 'slip');
}
