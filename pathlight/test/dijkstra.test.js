import test from "node:test";
import assert from "node:assert/strict";
import { createGrid } from "../src/grid.js";
import { dijkstra } from "../src/algorithms/dijkstra.js";
import { bfs } from "../src/algorithms/bfs.js";

test("dijkstra matches bfs on an unweighted grid", () => {
  const grid = createGrid(5, 5);
  const start = { row: 0, col: 0 };
  const end = { row: 4, col: 4 };
  const dijkstraResult = dijkstra(grid, start, end);
  const bfsResult = bfs(grid, start, end);
  assert.equal(dijkstraResult.found, true);
  assert.equal(dijkstraResult.path.length, bfsResult.path.length);
});

test("dijkstra routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = dijkstra(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("dijkstra reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = dijkstra(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
});

test("dijkstra prefers a longer route over cheap terrain to a shorter one through expensive terrain", () => {
  // A straight 1-row path from (0,0) to (0,4) exists, but its middle cell costs 100 to enter.
  // A detour through row 1 (all weight 1) costs less overall, even though it visits more cells.
  const grid = createGrid(2, 5);
  grid[0][2] = { type: "empty", weight: 100 };

  const result = dijkstra(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.ok(result.path.some((step) => step.row === 1), "expected the path to detour through row 1");
  assert.ok(!result.path.some((step) => step.row === 0 && step.col === 2), "expected the path to avoid the expensive cell");
});
