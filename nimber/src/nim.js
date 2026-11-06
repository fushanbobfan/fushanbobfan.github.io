// Nim on a list of pile sizes. Normal play: taking the last stone wins.
// Misère play: taking the last stone loses.

export function nimSum(heaps) {
  return heaps.reduce((sum, h) => sum ^ h, 0);
}

// Bouton's rule. Misère differs only once no pile holds two or more stones:
// the mover then wins exactly when an even number of single stones remain.
export function isWinning(heaps, misere = false) {
  if (misere && heaps.every((h) => h <= 1)) {
    return heaps.filter((h) => h === 1).length % 2 === 0;
  }
  return nimSum(heaps) !== 0;
}

export function legalMoves(heaps) {
  const moves = [];
  heaps.forEach((h, heap) => {
    for (let to = 0; to < h; to++) moves.push({ heap, to });
  });
  return moves;
}

export function applyMove(heaps, { heap, to }) {
  const next = heaps.slice();
  next[heap] = to;
  return next;
}

export function winningMoves(heaps, misere = false) {
  return legalMoves(heaps).filter((m) => !isWinning(applyMove(heaps, m), misere));
}

// The powers of two a pile splits into, largest first: 13 -> [8, 4, 1].
export function blocks(size) {
  const out = [];
  for (let p = 1 << 30; p > 0; p >>= 1) if (size & p) out.push(p);
  return out;
}

// A block size is odd when it appears in an odd number of piles.
// These are exactly the set bits of the nim-sum.
export function oddBlockSizes(heaps) {
  return blocks(nimSum(heaps));
}

// 'good' keeps a won position won, 'slip' throws it away,
// 'lost' is any move from a position that was already lost.
export function judgeMove(heaps, move, misere = false) {
  if (!isWinning(heaps, misere)) return 'lost';
  return isWinning(applyMove(heaps, move), misere) ? 'slip' : 'good';
}
