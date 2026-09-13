import test from "node:test";
import assert from "node:assert/strict";
import { createGrid, setNodeWeight } from "../src/grid.js";
import { fringeSearch } from "../src/algorithms/fringeSearch.js";
import { astar } from "../src/algorithms/astar.js";
import { dijkstra } from "../src/algorithms/dijkstra.js";
import { generateMaze } from "../src/maze.js";
import { generateTerrain } from "../src/terrain.js";

// A small seeded PRNG (mulberry32) so the maze+terrain fixture below is deterministic and
// reproducible across runs, instead of depending on Math.random. Matches maze.test.js's own copy.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pathCost = (grid, path) => {
  let cost = 0;
  for (let i = 1; i < path.length; i++) cost += grid[path[i].row][path[i].col].weight;
  return cost;
};

test("finds the straight-line path across an empty grid", () => {
  const grid = createGrid(1, 5);
  const result = fringeSearch(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.deepEqual(
    result.path,
    [0, 1, 2, 3, 4].map((col) => ({ row: 0, col })),
  );
});

test("starting and ending on the same cell returns a single-cell path", () => {
  const grid = createGrid(3, 3);
  const result = fringeSearch(grid, { row: 1, col: 1 }, { row: 1, col: 1 });
  assert.equal(result.found, true);
  assert.deepEqual(result.path, [{ row: 1, col: 1 }]);
});

test("routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = fringeSearch(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("reports unreachable when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = fringeSearch(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
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
  const result = fringeSearch(grid, start, end);
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

test("prefers a longer detour over a shorter route through expensive terrain", () => {
  // The straight top row is fewest-steps, but its middle cell costs 100; dropping to row 1
  // and back is cheaper overall.
  let grid = createGrid(2, 5);
  grid = setNodeWeight(grid, 0, 2, 100);
  const result = fringeSearch(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.ok(
    result.path.some((step) => step.row === 1),
    "should detour through the cheap row instead of the expensive middle cell",
  );
  assert.equal(
    pathCost(grid, result.path),
    pathCost(grid, dijkstra(grid, { row: 0, col: 0 }, { row: 0, col: 4 }).path),
  );
});

test("matches astar's path length on an unweighted open grid", () => {
  const grid = createGrid(8, 8);
  const start = { row: 0, col: 0 };
  const end = { row: 7, col: 7 };
  assert.equal(
    fringeSearch(grid, start, end).path.length,
    astar(grid, start, end).path.length,
  );
});

test("matches Dijkstra's exact path cost across many random weighted grids", () => {
  let seed = 246813579;
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
    const actual = fringeSearch(grid, start, end);
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

test("settles a bounded number of cells on a long winding maze, rather than repeatedly re-expanding the way a naive iterative-deepening search would", () => {
  // A generated maze's single winding corridor, with mixed-cost terrain layered on top, is the
  // classic case where an iterative-deepening search without a persistent fringe re-explores the
  // same dead ends on every threshold sweep — an unbounded, exponential blow-up in the worst
  // case. Fringe search's persistent list should instead settle a number of cells on the same
  // order as the grid itself.
  const rows = 15;
  const cols = 30;
  let grid = createGrid(rows, cols);
  grid = generateMaze(rows, cols, mulberry32(1));
  const weights = generateTerrain(rows, cols, mulberry32(2));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].type !== "wall") grid[r][c] = { ...grid[r][c], weight: weights[r][c] };
    }
  }
  const start = { row: 0, col: 0 };
  const end = { row: rows - 1, col: cols - 1 };
  const result = fringeSearch(grid, start, end);
  assert.equal(result.found, true);
  assert.ok(
    result.visitedOrder.length < rows * cols * 5,
    `expected a bounded number of expansions, got ${result.visitedOrder.length} for a ${rows * cols}-cell maze`,
  );
});
