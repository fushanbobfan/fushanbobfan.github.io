import test from "node:test";
import assert from "node:assert/strict";
import { createGrid } from "../src/grid.js";
import { weightedAstar, DEFAULT_WEIGHT } from "../src/algorithms/weightedAstar.js";
import { astar } from "../src/algorithms/astar.js";
import { dijkstra } from "../src/algorithms/dijkstra.js";

const pathCost = (grid, path) =>
  path.slice(1).reduce((cost, step) => cost + grid[step.row][step.col].weight, 0);

function assertContiguous(path) {
  for (let i = 1; i < path.length; i++) {
    const d =
      Math.abs(path[i].row - path[i - 1].row) + Math.abs(path[i].col - path[i - 1].col);
    assert.equal(d, 1, `path step ${i} is not orthogonally adjacent`);
  }
}

test("weightedAstar behaves exactly like A* at weight 1", () => {
  const grid = createGrid(8, 8);
  grid[3][4] = { type: "empty", weight: 15 };
  grid[4][4] = { type: "empty", weight: 15 };
  const start = { row: 0, col: 0 };
  const end = { row: 7, col: 7 };
  const w1 = weightedAstar(grid, start, end, 1);
  const a = astar(grid, start, end);
  assert.deepEqual(w1.path, a.path);
  assert.equal(w1.visitedOrder.length, a.visitedOrder.length);
});

test("weightedAstar finds an orthogonally contiguous path on an open grid", () => {
  const grid = createGrid(6, 6);
  const result = weightedAstar(grid, { row: 0, col: 0 }, { row: 5, col: 5 });
  assert.equal(result.found, true);
  assert.equal(result.path[0].row === 0 && result.path[0].col === 0, true);
  assert.equal(result.path.at(-1).row === 5 && result.path.at(-1).col === 5, true);
  assertContiguous(result.path);
  // an open uniform grid has no detour to miss, so even an inflated heuristic stays optimal
  assert.equal(result.path.length - 1, 10);
});

test("weightedAstar routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = weightedAstar(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("weightedAstar reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = weightedAstar(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
  assert.deepEqual(result.path, []);
});

test("weightedAstar's path cost stays within the weight bound of the optimum", () => {
  // a wall of expensive terrain across the direct route; the cheap way around is a detour
  // weighted A* is tempted to skip.
  const grid = createGrid(12, 12);
  for (let row = 0; row < 10; row++) {
    grid[row][6] = { type: "empty", weight: 40 };
  }
  const start = { row: 0, col: 0 };
  const end = { row: 11, col: 11 };
  const optimal = pathCost(grid, dijkstra(grid, start, end).path);
  const result = weightedAstar(grid, start, end, DEFAULT_WEIGHT);
  assert.equal(result.found, true);
  assertContiguous(result.path);
  assert.ok(
    pathCost(grid, result.path) <= DEFAULT_WEIGHT * optimal,
    "weighted A* must not exceed weight * optimal cost",
  );
});

test("a larger weight never explores more cells than a smaller one here", () => {
  const grid = createGrid(20, 20);
  const start = { row: 0, col: 0 };
  const end = { row: 19, col: 19 };
  const w1 = weightedAstar(grid, start, end, 1).visitedOrder.length;
  const w2 = weightedAstar(grid, start, end, 2).visitedOrder.length;
  const w5 = weightedAstar(grid, start, end, 5).visitedOrder.length;
  assert.ok(w2 <= w1);
  assert.ok(w5 <= w2);
});

test("weightedAstar is deterministic and defaults its weight", () => {
  const grid = createGrid(10, 10);
  grid[5][5] = { type: "empty", weight: 9 };
  const start = { row: 1, col: 1 };
  const end = { row: 8, col: 8 };
  const a = weightedAstar(grid, start, end);
  const b = weightedAstar(grid, start, end, DEFAULT_WEIGHT);
  assert.deepEqual(a.path, b.path);
  assert.deepEqual(a.visitedOrder, b.visitedOrder);
});

test("weightedAstar falls back to the default weight for a nonsense value", () => {
  const grid = createGrid(7, 7);
  const start = { row: 0, col: 0 };
  const end = { row: 6, col: 6 };
  const withDefault = weightedAstar(grid, start, end, DEFAULT_WEIGHT);
  for (const bad of [0, -3, NaN, Infinity, "big", undefined]) {
    assert.deepEqual(weightedAstar(grid, start, end, bad).path, withDefault.path);
  }
});
