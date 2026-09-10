import test from "node:test";
import assert from "node:assert/strict";
import { createGrid, setNodeWeight } from "../src/grid.js";
import { bidirectionalDijkstra } from "../src/algorithms/bidirectionalDijkstra.js";
import { dijkstra } from "../src/algorithms/dijkstra.js";
import { bfs } from "../src/algorithms/bfs.js";

const pathCost = (grid, path) => {
  let cost = 0;
  for (let i = 1; i < path.length; i++) cost += grid[path[i].row][path[i].col].weight;
  return cost;
};

test("finds the straight-line path across an empty grid", () => {
  const grid = createGrid(1, 5);
  const result = bidirectionalDijkstra(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.deepEqual(
    result.path,
    [0, 1, 2, 3, 4].map((col) => ({ row: 0, col })),
  );
});

test("starting and ending on the same cell returns a single-cell path", () => {
  const grid = createGrid(3, 3);
  const result = bidirectionalDijkstra(grid, { row: 1, col: 1 }, { row: 1, col: 1 });
  assert.equal(result.found, true);
  assert.deepEqual(result.path, [{ row: 1, col: 1 }]);
});

test("routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = bidirectionalDijkstra(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
  assert.ok(result.path.some((step) => step.row === 2));
});

test("reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = bidirectionalDijkstra(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
  assert.deepEqual(result.path, []);
});

test("the path is a valid chain of adjacent, non-wall cells from start to end", () => {
  const grid = createGrid(6, 6);
  grid[2][2] = { type: "wall", weight: 1 };
  grid[2][3] = { type: "wall", weight: 1 };
  grid[3][2] = { type: "wall", weight: 1 };
  const start = { row: 0, col: 0 };
  const end = { row: 5, col: 5 };
  const result = bidirectionalDijkstra(grid, start, end);
  assert.equal(result.found, true);
  assert.deepEqual(result.path[0], start);
  assert.deepEqual(result.path[result.path.length - 1], end);
  for (let i = 1; i < result.path.length; i++) {
    const prev = result.path[i - 1];
    const step = result.path[i];
    assert.equal(
      Math.abs(step.row - prev.row) + Math.abs(step.col - prev.col),
      1,
      `step ${i} isn't adjacent to the previous one`,
    );
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("visitedOrder never lists the same cell twice", () => {
  const grid = createGrid(5, 5);
  const result = bidirectionalDijkstra(grid, { row: 0, col: 0 }, { row: 4, col: 4 });
  const seen = new Set(result.visitedOrder.map((n) => `${n.row},${n.col}`));
  assert.equal(seen.size, result.visitedOrder.length);
});

test("prefers a longer detour over a shorter route through expensive terrain", () => {
  // The straight top row is fewest-steps, but its middle cell costs 100; dropping to row 1
  // and back is cheaper overall.
  let grid = createGrid(2, 5);
  grid = setNodeWeight(grid, 0, 2, 100);
  const result = bidirectionalDijkstra(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.ok(
    result.path.some((step) => step.row === 1),
    "should detour through the cheap row instead of the expensive middle cell",
  );
  assert.equal(pathCost(grid, result.path), pathCost(grid, dijkstra(grid, { row: 0, col: 0 }, { row: 0, col: 4 }).path));
});

test("matches Dijkstra's exact path cost across many random weighted grids", () => {
  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let compared = 0;
  for (let trial = 0; trial < 120; trial++) {
    const rows = 2 + Math.floor(rand() * 7);
    const cols = 2 + Math.floor(rand() * 7);
    const grid = createGrid(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < 0.2) grid[r][c] = { type: "wall", weight: 1 };
        else if (rand() < 0.3) grid[r][c] = { type: "empty", weight: 1 + Math.floor(rand() * 9) };
      }
    }
    const start = { row: Math.floor(rand() * rows), col: Math.floor(rand() * cols) };
    const end = { row: Math.floor(rand() * rows), col: Math.floor(rand() * cols) };
    if (grid[start.row][start.col].type === "wall") grid[start.row][start.col] = { type: "empty", weight: 1 };
    if (grid[end.row][end.col].type === "wall") grid[end.row][end.col] = { type: "empty", weight: 1 };

    const expected = dijkstra(grid, start, end);
    const actual = bidirectionalDijkstra(grid, start, end);
    assert.equal(actual.found, expected.found, `trial ${trial}: found disagreement`);
    if (expected.found) {
      assert.equal(
        pathCost(grid, actual.path),
        pathCost(grid, expected.path),
        `trial ${trial}: path cost disagreement`,
      );
      compared++;
    }
  }
  assert.ok(compared > 40, "the fuzz set should include plenty of reachable cases");
});

test("on an unweighted grid the path is as short as BFS's, on even and odd distances", () => {
  const cases = [
    { rows: 5, cols: 5, end: { row: 4, col: 4 } },
    { rows: 5, cols: 6, end: { row: 4, col: 5 } },
  ];
  for (const { rows, cols, end } of cases) {
    const grid = createGrid(rows, cols);
    const start = { row: 0, col: 0 };
    assert.equal(
      bidirectionalDijkstra(grid, start, end).path.length,
      bfs(grid, start, end).path.length,
    );
  }
});

test("typically settles fewer cells than one-directional Dijkstra on a large open grid", () => {
  const grid = createGrid(40, 40);
  const start = { row: 0, col: 20 };
  const end = { row: 39, col: 20 };
  const bi = bidirectionalDijkstra(grid, start, end);
  const one = dijkstra(grid, start, end);
  assert.ok(
    bi.visitedOrder.length < one.visitedOrder.length,
    `expected bidirectional (${bi.visitedOrder.length}) to settle fewer than Dijkstra (${one.visitedOrder.length})`,
  );
});
