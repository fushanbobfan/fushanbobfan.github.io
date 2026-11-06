// Wythoff's game as a queen on a quarter board. The queen at (a, b) moves left,
// down, or diagonally down-left, and whoever reaches (0, 0) wins. The same game is
// two piles of a and b stones: take from one pile, or the same number from both.

const SQRT5 = Math.sqrt(5);
export const PHI = (1 + SQRT5) / 2;

// k-th cold position (floor(k phi), floor(k phi) + k), with the smaller coordinate first.
export function coldPosition(k) {
  const a = Math.floor(k * PHI);
  return [a, a + k];
}

export function isCold(a, b) {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return coldPosition(high - low)[0] === low;
}

export function queenMoves([a, b]) {
  const moves = [];
  for (let x = 0; x < a; x++) moves.push({ a: x, b });
  for (let y = 0; y < b; y++) moves.push({ a, b: y });
  for (let d = 1; d <= Math.min(a, b); d++) moves.push({ a: a - d, b: b - d });
  return moves;
}

export function queenRules() {
  return {
    legalMoves: queenMoves,
    applyMove: (_, move) => [move.a, move.b],
    isWinning: ([a, b]) => !isCold(a, b),
    // A computer with nothing better shuffles one square and waits for a slip.
    stallMoves: ([a, b]) => queenMoves([a, b])
      .filter((m) => Math.max(a - m.a, b - m.b) === 1),
  };
}

export function isQueenMove([a, b], x, y) {
  if (x === a && y === b) return false;
  if (x > a || y > b || x < 0 || y < 0) return false;
  return x === a || y === b || a - x === b - y;
}

// The squares in the order the rule itself finds them: the first square no earlier
// cold square can reach is cold, and it rules out its row, column and diagonal.
export function sieveColdSquares(size) {
  const rows = new Set();
  const columns = new Set();
  const diagonals = new Set();
  const cold = [];
  for (let sum = 0; sum < 2 * size - 1; sum++) {
    for (let a = Math.max(0, sum - size + 1); a <= Math.min(sum, size - 1); a++) {
      const b = sum - a;
      if (columns.has(a) || rows.has(b) || diagonals.has(a - b)) continue;
      cold.push([a, b]);
      columns.add(a);
      rows.add(b);
      diagonals.add(a - b);
    }
  }
  return cold;
}

// Squares ruled out once the first `steps` cold squares are known.
export function shadowOf(coldSquares, steps) {
  const known = coldSquares.slice(0, steps);
  const columns = new Set(known.map(([a]) => a));
  const rows = new Set(known.map(([, b]) => b));
  const diagonals = new Set(known.map(([a, b]) => a - b));
  return (a, b) => columns.has(a) || rows.has(b) || diagonals.has(a - b);
}

// Nimbers of every square below size. A queen only moves toward the corner, so this
// table is the same whatever the board around it.
export function queenNimbers(size) {
  const g = Array.from({ length: size }, () => new Uint16Array(size));
  const seen = new Int32Array(3 * size + 4).fill(-1);
  for (let a = 0; a < size; a++) {
    for (let b = 0; b < size; b++) {
      const stamp = a * size + b;
      for (let x = 0; x < a; x++) seen[g[x][b]] = stamp;
      for (let y = 0; y < b; y++) seen[g[a][y]] = stamp;
      for (let d = 1; d <= Math.min(a, b); d++) seen[g[a - d][b - d]] = stamp;
      let v = 0;
      while (seen[v] === stamp) v++;
      g[a][b] = v;
    }
  }
  return g;
}

export function dealQueen(rng, { size, kind = 'any' }) {
  const low = Math.floor(size / 2);
  const coordinate = () => low + Math.floor(rng() * (size - low));
  for (let tries = 0; tries < 20000; tries++) {
    const a = coordinate();
    const b = coordinate();
    if (kind === 'any' || (kind === 'winning') === !isCold(a, b)) return [a, b];
  }
  throw new Error('no such square');
}
