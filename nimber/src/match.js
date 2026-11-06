// Nim as a game for turns.js, plus dealing a starting position.

import { applyMove, isWinning, legalMoves } from './nim.js';
import { createGame } from './turns.js';

export function nimRules(misere = false) {
  return {
    misere,
    lastMoverLoses: misere,
    legalMoves,
    applyMove,
    isWinning: (heaps) => isWinning(heaps, misere),
    // A computer with nothing better takes one stone and waits for a slip.
    stallMoves: (heaps) => legalMoves(heaps).filter((m) => heaps[m.heap] - m.to === 1),
  };
}

export function createMatch({ heaps, misere = false, first = 'you' }) {
  return { ...createGame(nimRules(misere), heaps.slice(), first), misere };
}

export function deal(rng, { piles, largest, kind = 'any', misere = false }) {
  for (let tries = 0; tries < 20000; tries++) {
    const heaps = Array.from({ length: piles }, () => 1 + Math.floor(rng() * largest));
    const wins = isWinning(heaps, misere);
    if (kind === 'any' || (kind === 'winning') === wins) return heaps;
  }
  throw new Error('no such position');
}
