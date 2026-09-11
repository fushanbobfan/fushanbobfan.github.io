import test from "node:test";
import assert from "node:assert/strict";
import { createGrid } from "../src/grid.js";
import { bfs } from "../src/algorithms/bfs.js";
import { dfs } from "../src/algorithms/dfs.js";

test("dfs finds the straight-line path across an empty grid", () => {
  const grid = createGrid(1, 5);
  const result = dfs(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.deepEqual(
    result.path,
    [0, 1, 2, 3, 4].map((col) => ({ row: 0, col }))
  );
});

test("dfs routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = dfs(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
  assert.ok(result.path.some((step) => step.row === 2));
});

test("dfs reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = dfs(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
  assert.deepEqual(result.path, []);
});

test("dfs starting and ending on the same cell returns a single-cell path", () => {
  const grid = createGrid(3, 3);
  const result = dfs(grid, { row: 1, col: 1 }, { row: 1, col: 1 });
  assert.equal(result.found, true);
  assert.deepEqual(result.path, [{ row: 1, col: 1 }]);
});

test("dfs's visitedOrder never revisits the same cell twice", () => {
  const grid = createGrid(4, 4);
  const result = dfs(grid, { row: 0, col: 0 }, { row: 3, col: 3 });
  const seen = new Set(result.visitedOrder.map((n) => `${n.row},${n.col}`));
  assert.equal(seen.size, result.visitedOrder.length);
});

test("dfs offers no shortest-path guarantee: it can find a longer route than bfs", () => {
  // A wall down column 1 forces the very first move down column 0; the only way back up to
  // row 0 without crossing that wall is via column 2, so both searches detour the same way
  // round — but dfs's stack order commits to looping all the way around through row 4 and
  // column 4 before backtracking, while bfs's ring-by-ring expansion finds the shorter of the
  // two routes around the wall. Verified empirically, not derived from the algorithms' rules.
  const grid = createGrid(5, 5);
  for (const row of [0, 1, 2, 3]) {
    grid[row][1] = { type: "wall", weight: 1 };
  }
  const start = { row: 0, col: 0 };
  const end = { row: 0, col: 4 };

  const bfsResult = bfs(grid, start, end);
  const dfsResult = dfs(grid, start, end);

  assert.equal(bfsResult.found, true);
  assert.equal(dfsResult.found, true);
  assert.equal(bfsResult.path.length, 13);
  assert.equal(dfsResult.path.length, 17);
  assert.ok(
    dfsResult.path.length > bfsResult.path.length,
    "dfs is not guaranteed to match bfs's shortest path"
  );
});
