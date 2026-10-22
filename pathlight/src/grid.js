// The grid model, kept free of any DOM or canvas dependency so it can be built, mutated, and
// searched in plain tests, with rendering left entirely to main.js.

export const EMPTY = "empty";
export const WALL = "wall";
export const START = "start";
export const END = "end";

/**
 * A `rows` x `cols` grid of plain cells, all empty and unit-weight.
 */
export function createGrid(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ type: EMPTY, weight: 1 }))
  );
}

export function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function inBounds(grid, row, col) {
  return row >= 0 && row < grid.length && col >= 0 && col < grid[0].length;
}

/**
 * The up-to-four orthogonal neighbors of `(row, col)` that are in bounds and not walls.
 * Diagonal movement is deliberately unsupported: every algorithm built on this shares the
 * same movement rule, so BFS's "fewest steps" and Dijkstra/A*'s "cheapest path" agree on
 * what a single step means.
 */
export function neighbors(grid, row, col) {
  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const result = [];
  for (const [dr, dc] of deltas) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(grid, r, c) && grid[r][c].type !== WALL) {
      result.push({ row: r, col: c });
    }
  }
  return result;
}

/**
 * The `{row, col}` of the first cell matching `type`, or `null` if there isn't one — e.g. no
 * start or end has been placed yet.
 */
export function findNodeOfType(grid, type) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col].type === type) return { row, col };
    }
  }
  return null;
}

/**
 * Returns a new grid with every cell of type `from` reset to `EMPTY`, e.g. clearing the
 * previous start before placing a new one — a grid should only ever have at most one start
 * and one end.
 */
export function clearType(grid, type) {
  return grid.map((row) => row.map((cell) => (cell.type === type ? { ...cell, type: EMPTY } : cell)));
}

/**
 * Returns a new grid with `(row, col)` set to `type`, clearing any prior START/END first if
 * `type` is itself START or END, so placing a new one moves it rather than adding a second.
 */
export function setNodeType(grid, row, col, type) {
  const next = type === START || type === END ? clearType(grid, type) : cloneGrid(grid);
  next[row][col] = { ...next[row][col], type };
  return next;
}

/**
 * Returns a new grid with `(row, col)`'s weight changed — the cost a weighted-search algorithm
 * (Dijkstra, A*) pays to step into that cell. Left untouched by `setNodeType`, so turning a
 * cell into a wall doesn't erase whatever weight it had if it's later cleared back to empty.
 */
export function setNodeWeight(grid, row, col, weight) {
  const next = cloneGrid(grid);
  next[row][col] = { ...next[row][col], weight };
  return next;
}
