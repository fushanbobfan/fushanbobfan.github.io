import test from "node:test";
import assert from "node:assert/strict";
import { createGrid } from "../src/grid.js";
import { bfs } from "../src/algorithms/bfs.js";

test("bfs finds the straight-line path across an empty grid", () => {
  const grid = createGrid(1, 5);
  const result = bfs(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.deepEqual(
    result.path,
    [0, 1, 2, 3, 4].map((col) => ({ row: 0, col }))
  );
});

test("bfs routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  // Column 1 is blocked except row 2, so the only route from (0,0) to (0,2) detours down and back up.
  const result = bfs(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
  assert.ok(result.path.some((step) => step.row === 2));
});

test("bfs reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = bfs(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
  assert.deepEqual(result.path, []);
});

test("bfs's path length is the true shortest distance, even when a longer route exists", () => {
  const grid = createGrid(5, 5);
  const result = bfs(grid, { row: 0, col: 0 }, { row: 4, col: 4 });
  assert.equal(result.found, true);
  // Manhattan distance is 8 steps, so the path (including both endpoints) has 9 cells.
  assert.equal(result.path.length, 9);
});

test("bfs starting and ending on the same cell returns a single-cell path", () => {
  const grid = createGrid(3, 3);
  const result = bfs(grid, { row: 1, col: 1 }, { row: 1, col: 1 });
  assert.equal(result.found, true);
  assert.deepEqual(result.path, [{ row: 1, col: 1 }]);
});

test("bfs's visitedOrder never revisits the same cell twice", () => {
  const grid = createGrid(4, 4);
  const result = bfs(grid, { row: 0, col: 0 }, { row: 3, col: 3 });
  const seen = new Set(result.visitedOrder.map((n) => `${n.row},${n.col}`));
  assert.equal(seen.size, result.visitedOrder.length);
});
