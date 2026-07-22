// Randomized depth-first search (a.k.a. the "recursive backtracker"), a standard maze
// generation algorithm. It only ever treats even-indexed rows/columns as passages, carving a
// wall cell between two passages when it links them — the odd-indexed rows/columns start (and,
// unless carved through, stay) walls. Kept free of any DOM dependency, like the rest of the
// project's algorithms, and takes its random source as a parameter so it can be tested
// deterministically instead of depending on `Math.random` directly.

function shuffled(items, randomFn) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Builds a `rows` x `cols` grid of booleans (`true` = wall, `false` = passage) via a randomized
 * depth-first carve starting from `(0, 0)`. Every even `(row, col)` reachable from the start —
 * which, since carving begins from an empty grid with no pre-existing obstacles, is every even
 * `(row, col)` in bounds — ends up connected by a unique path with no cycles (a "perfect" maze).
 */
export function generateMaze(rows, cols, randomFn = Math.random) {
  const wall = Array.from({ length: rows }, () => Array(cols).fill(true));
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

  function inBounds(row, col) {
    return row >= 0 && row < rows && col >= 0 && col < cols;
  }

  function carveFrom(row, col) {
    visited[row][col] = true;
    wall[row][col] = false;

    const directions = shuffled(
      [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ],
      randomFn
    );

    for (const [dRow, dCol] of directions) {
      const nextRow = row + dRow;
      const nextCol = col + dCol;
      if (inBounds(nextRow, nextCol) && !visited[nextRow][nextCol]) {
        wall[row + dRow / 2][col + dCol / 2] = false;
        carveFrom(nextRow, nextCol);
      }
    }
  }

  carveFrom(0, 0);
  return wall;
}
