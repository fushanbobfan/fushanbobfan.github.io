import test from "node:test";
import assert from "node:assert/strict";
import { createGrid } from "../src/grid.js";
import { bidirectionalSearch } from "../src/algorithms/bidirectional.js";
import { bfs } from "../src/algorithms/bfs.js";

test("bidirectionalSearch finds the straight-line path across an empty grid", () => {
  const grid = createGrid(1, 5);
  const result = bidirectionalSearch(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.deepEqual(
    result.path,
    [0, 1, 2, 3, 4].map((col) => ({ row: 0, col }))
  );
});

test("bidirectionalSearch routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  // Column 1 is blocked except row 2, so the only route from (0,0) to (0,2) detours down and back up.
  const result = bidirectionalSearch(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
  assert.ok(result.path.some((step) => step.row === 2));
});

test("bidirectionalSearch reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = bidirectionalSearch(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
  assert.deepEqual(result.path, []);
});

test("bidirectionalSearch starting and ending on the same cell returns a single-cell path", () => {
  const grid = createGrid(3, 3);
  const result = bidirectionalSearch(grid, { row: 1, col: 1 }, { row: 1, col: 1 });
  assert.equal(result.found, true);
  assert.deepEqual(result.path, [{ row: 1, col: 1 }]);
});

test("bidirectionalSearch's visitedOrder never revisits the same cell twice", () => {
  const grid = createGrid(4, 4);
  const result = bidirectionalSearch(grid, { row: 0, col: 0 }, { row: 3, col: 3 });
  const seen = new Set(result.visitedOrder.map((n) => `${n.row},${n.col}`));
  assert.equal(seen.size, result.visitedOrder.length);
});

test("bidirectionalSearch's path is a valid chain of adjacent, non-wall cells", () => {
  const grid = createGrid(6, 6);
  grid[2][2] = { type: "wall", weight: 1 };
  grid[2][3] = { type: "wall", weight: 1 };
  grid[3][2] = { type: "wall", weight: 1 };
  const result = bidirectionalSearch(grid, { row: 0, col: 0 }, { row: 5, col: 5 });
  assert.equal(result.found, true);
  for (let i = 1; i < result.path.length; i++) {
    const prev = result.path[i - 1];
    const step = result.path[i];
    const manhattan = Math.abs(step.row - prev.row) + Math.abs(step.col - prev.col);
    assert.equal(manhattan, 1, `step ${i} isn't adjacent to the previous one`);
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("bidirectionalSearch's path is exactly as short as BFS's shortest path, on both even and odd distances", () => {
  const cases = [
    { rows: 5, cols: 5, end: { row: 4, col: 4 } }, // Manhattan distance 8 (even)
    { rows: 5, cols: 6, end: { row: 4, col: 5 } }, // Manhattan distance 9 (odd)
  ];
  for (const { rows, cols, end } of cases) {
    const grid = createGrid(rows, cols);
    const start = { row: 0, col: 0 };
    const biResult = bidirectionalSearch(grid, start, end);
    const bfsResult = bfs(grid, start, end);
    assert.equal(biResult.path.length, bfsResult.path.length);
  }
});

test("bidirectionalSearch typically visits far fewer cells than BFS on a large open grid", () => {
  // Two circles of radius D/2 cover much less area than BFS's single circle of radius D — most
  // pronounced here since start and end sit on opposite edges rather than opposite corners,
  // so BFS's circle keeps growing past the point where bidirectional's two have already met.
  const grid = createGrid(40, 40);
  const start = { row: 0, col: 20 };
  const end = { row: 39, col: 20 };
  const biResult = bidirectionalSearch(grid, start, end);
  const bfsResult = bfs(grid, start, end);
  assert.ok(biResult.visitedOrder.length < bfsResult.visitedOrder.length);
});
