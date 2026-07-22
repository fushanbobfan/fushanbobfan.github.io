import test from "node:test";
import assert from "node:assert/strict";
import { createGrid } from "../src/grid.js";
import { astar } from "../src/algorithms/astar.js";
import { dijkstra } from "../src/algorithms/dijkstra.js";

test("astar finds a path of the same cost as dijkstra on an unweighted grid", () => {
  const grid = createGrid(6, 6);
  const start = { row: 0, col: 0 };
  const end = { row: 5, col: 5 };
  const astarResult = astar(grid, start, end);
  const dijkstraResult = dijkstra(grid, start, end);
  assert.equal(astarResult.found, true);
  // Both are shortest-path algorithms on a uniform grid, so their path lengths must agree even
  // though A*'s heuristic likely makes it visit far fewer cells to get there.
  assert.equal(astarResult.path.length, dijkstraResult.path.length);
});

test("astar visits no more cells than dijkstra on an open grid", () => {
  const grid = createGrid(10, 10);
  const start = { row: 0, col: 0 };
  const end = { row: 9, col: 9 };
  const astarResult = astar(grid, start, end);
  const dijkstraResult = dijkstra(grid, start, end);
  assert.ok(astarResult.visitedOrder.length <= dijkstraResult.visitedOrder.length);
});

test("astar routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = astar(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("astar reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = astar(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
});

test("astar prefers a longer route over cheap terrain to a shorter one through expensive terrain", () => {
  const grid = createGrid(2, 5);
  grid[0][2] = { type: "empty", weight: 100 };

  const result = astar(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.ok(!result.path.some((step) => step.row === 0 && step.col === 2));
});
