// Two standard maze generation algorithms, both treating only even-indexed rows/columns as
// passages and carving a wall cell between two passages when it links them — the odd-indexed
// rows/columns start (and, unless carved through, stay) walls. Kept free of any DOM dependency,
// like the rest of the project's algorithms, and each takes its random source as a parameter so
// it can be tested deterministically instead of depending on `Math.random` directly.

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

/**
 * Builds a `rows` x `cols` grid of booleans (`true` = wall, `false` = passage) via randomized
 * Prim's algorithm: starting from `(0, 0)`, repeatedly picks a uniformly random edge off the
 * growing maze's frontier (rather than always extending the most recent branch, as the
 * backtracker does) and carves it if it reaches new ground. The result is still a "perfect"
 * maze — the same connectivity guarantee as `generateMaze` — but with a visibly different
 * texture: many short dead ends branching off a broad, evenly-grown region instead of the
 * backtracker's long, winding corridors.
 */
export function generateMazePrim(rows, cols, randomFn = Math.random) {
  const wall = Array.from({ length: rows }, () => Array(cols).fill(true));
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

  function inBounds(row, col) {
    return row >= 0 && row < rows && col >= 0 && col < cols;
  }

  // Each frontier entry is an unvisited cell two steps from an already-visited one, paired with
  // the visited cell it would be carved in from. A cell can enter the frontier more than once
  // (reachable from two directions); the second copy is skipped when drawn, since by then it's
  // already visited.
  const frontier = [];

  function addFrontier(row, col) {
    for (const [dRow, dCol] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ]) {
      const nextRow = row + dRow;
      const nextCol = col + dCol;
      if (inBounds(nextRow, nextCol) && !visited[nextRow][nextCol]) {
        frontier.push({ row: nextRow, col: nextCol, fromRow: row, fromCol: col });
      }
    }
  }

  visited[0][0] = true;
  wall[0][0] = false;
  addFrontier(0, 0);

  while (frontier.length > 0) {
    const index = Math.floor(randomFn() * frontier.length);
    const { row, col, fromRow, fromCol } = frontier[index];
    frontier.splice(index, 1);
    if (visited[row][col]) continue;

    visited[row][col] = true;
    wall[row][col] = false;
    wall[(row + fromRow) / 2][(col + fromCol) / 2] = false;
    addFrontier(row, col);
  }

  return wall;
}
