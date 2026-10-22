import test from "node:test";
import assert from "node:assert/strict";
import { createGrid } from "../src/grid.js";
import { greedyBestFirstSearch } from "../src/algorithms/greedy.js";
import { bfs } from "../src/algorithms/bfs.js";

test("greedyBestFirstSearch finds the straight-line path across an empty grid", () => {
  const grid = createGrid(1, 5);
  const result = greedyBestFirstSearch(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.deepEqual(
    result.path,
    [0, 1, 2, 3, 4].map((col) => ({ row: 0, col }))
  );
});

test("greedyBestFirstSearch routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = greedyBestFirstSearch(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("greedyBestFirstSearch reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = greedyBestFirstSearch(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
  assert.deepEqual(result.path, []);
});

test("greedyBestFirstSearch's path is a valid chain of adjacent, non-wall cells", () => {
  const grid = createGrid(6, 6);
  grid[2][2] = { type: "wall", weight: 1 };
  grid[2][3] = { type: "wall", weight: 1 };
  grid[3][2] = { type: "wall", weight: 1 };
  const result = greedyBestFirstSearch(grid, { row: 0, col: 0 }, { row: 5, col: 5 });
  assert.equal(result.found, true);
  for (let i = 1; i < result.path.length; i++) {
    const prev = result.path[i - 1];
    const step = result.path[i];
    const manhattan = Math.abs(step.row - prev.row) + Math.abs(step.col - prev.col);
    assert.equal(manhattan, 1, `step ${i} isn't adjacent to the previous one`);
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("greedyBestFirstSearch typically visits far fewer cells than BFS on a large open grid", () => {
  const grid = createGrid(30, 30);
  const start = { row: 0, col: 0 };
  const end = { row: 29, col: 29 };
  const greedyResult = greedyBestFirstSearch(grid, start, end);
  const bfsResult = bfs(grid, start, end);
  assert.ok(greedyResult.visitedOrder.length < bfsResult.visitedOrder.length);
});

test("greedyBestFirstSearch on an empty grid finds a path exactly as short as BFS's", () => {
  // With nothing to route around, the heuristic never points the wrong way — greedy's lack of
  // an optimality guarantee only bites when there's a genuine choice between routes.
  const grid = createGrid(8, 8);
  const start = { row: 0, col: 0 };
  const end = { row: 7, col: 7 };
  const greedyResult = greedyBestFirstSearch(grid, start, end);
  const bfsResult = bfs(grid, start, end);
  assert.equal(greedyResult.path.length, bfsResult.path.length);
});
