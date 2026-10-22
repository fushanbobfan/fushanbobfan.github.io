import test from "node:test";
import assert from "node:assert/strict";
import { createGrid, setNodeWeight } from "../src/grid.js";
import { idaStar, MAX_EXPANSIONS } from "../src/algorithms/idaStar.js";
import { astar } from "../src/algorithms/astar.js";
import { dijkstra } from "../src/algorithms/dijkstra.js";
import { fringeSearch } from "../src/algorithms/fringeSearch.js";
import { generateMaze } from "../src/maze.js";
import { generateTerrain } from "../src/terrain.js";

// A small seeded PRNG (mulberry32) so the maze+terrain fixture below is deterministic and
// reproducible across runs, instead of depending on Math.random. Matches fringeSearch.test.js's
// own copy.
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
  const result = idaStar(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  assert.equal(result.found, true);
  assert.deepEqual(
    result.path,
    [0, 1, 2, 3, 4].map((col) => ({ row: 0, col })),
  );
});

test("starting and ending on the same cell returns a single-cell path", () => {
  const grid = createGrid(3, 3);
  const result = idaStar(grid, { row: 1, col: 1 }, { row: 1, col: 1 });
  assert.equal(result.found, true);
  assert.deepEqual(result.path, [{ row: 1, col: 1 }]);
});

test("routes around a wall rather than through it", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = idaStar(grid, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(result.found, true);
  for (const step of result.path) {
    assert.notEqual(grid[step.row][step.col].type, "wall");
  }
});

test("reports unreachable, not aborted, when walls fully enclose the end", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const result = idaStar(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  assert.equal(result.found, false);
  assert.equal(result.aborted, undefined, "a small, genuinely enclosed grid should exhaust itself, not hit the cap");
  assert.deepEqual(result.path, []);
});

test("the path is a valid chain of adjacent, non-wall cells from start to end", () => {
  const grid = createGrid(6, 6);
  grid[2][2] = { type: "wall", weight: 1 };
  grid[2][3] = { type: "wall", weight: 1 };
  grid[3][2] = { type: "wall", weight: 1 };
  const start = { row: 0, col: 0 };
  const end = { row: 5, col: 5 };
  const result = idaStar(grid, start, end);
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
  const result = idaStar(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
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
    idaStar(grid, start, end).path.length,
    astar(grid, start, end).path.length,
  );
});

test("matches Dijkstra's exact path cost across many small random weighted grids", () => {
  // Grids are kept small (at most 5x5): unlike the other algorithms' 120-trial fuzz tests,
  // IDA* re-walks the tree from scratch on every threshold rise, so its cost per trial grows
  // much faster with grid size — this is exactly the blow-up MAX_EXPANSIONS exists to catch,
  // not something a correctness fuzz test should be routinely hitting.
  let seed = 246813579;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let compared = 0;
  for (let trial = 0; trial < 60; trial++) {
    const rows = 2 + Math.floor(rand() * 4);
    const cols = 2 + Math.floor(rand() * 4);
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
    const actual = idaStar(grid, start, end);
    assert.equal(actual.aborted, undefined, `trial ${trial}: shouldn't hit the expansion cap on a grid this small`);
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
  assert.ok(compared > 20, "the fuzz set should include plenty of reachable cases");
});

test("re-expands more cells than fringe search on a mixed-cost corridor with several thresholds", () => {
  // Demonstrates the exact tradeoff idaStar.js's module comment describes: fringe search's
  // persistent fringe carries settled work across threshold sweeps, while IDA* restarts from
  // the root every time — so on the same instance it visits at least as many cells.
  const rows = 6;
  const cols = 20;
  let grid = createGrid(rows, cols);
  for (let c = 1; c < cols - 1; c += 2) {
    for (let r = 0; r < rows - 1; r++) grid[r][c] = { type: "wall", weight: 1 };
  }
  const start = { row: 0, col: 0 };
  const end = { row: 0, col: cols - 1 };
  const ida = idaStar(grid, start, end);
  const fringe = fringeSearch(grid, start, end);
  assert.equal(ida.found, true);
  assert.equal(fringe.found, true);
  assert.ok(
    ida.visitedOrder.length >= fringe.visitedOrder.length,
    `expected IDA* (${ida.visitedOrder.length} visits) to re-expand at least as much as fringe search (${fringe.visitedOrder.length})`,
  );
});

test("gives up and reports aborted rather than blowing up on a large weighted maze", () => {
  // The default board size with a generated maze and weighted terrain is IDA*'s well-known
  // worst case: many distinct path costs mean many distinct thresholds, and a fresh
  // depth-first pass on every one of them. Without MAX_EXPANSIONS this can run for minutes (it
  // was observed exceeding a node heap limit on a grid smaller than this one); with it, it
  // should give up quickly and say so rather than silently reporting "no path" or hanging the
  // caller. The maze generator guarantees start and end are connected, so aborting here can
  // only mean the cap was hit, never that the grid was actually unreachable.
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

  const startTime = Date.now();
  const result = idaStar(grid, { row: 0, col: 0 }, { row: rows - 1, col: cols - 1 });
  const elapsedMs = Date.now() - startTime;

  assert.equal(result.aborted, true);
  assert.equal(result.found, false);
  assert.equal(result.visitedOrder.length, MAX_EXPANSIONS);
  assert.ok(elapsedMs < 5000, `expected the cap to keep this fast, took ${elapsedMs}ms`);
});
