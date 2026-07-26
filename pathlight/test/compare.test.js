import test from "node:test";
import assert from "node:assert/strict";
import { createGrid, setNodeWeight } from "../src/grid.js";
import { compareAlgorithms, pathCost } from "../src/compare.js";

test("compareAlgorithms returns all five algorithms in a stable order", () => {
  const grid = createGrid(3, 3);
  const results = compareAlgorithms(grid, { row: 0, col: 0 }, { row: 2, col: 2 });
  assert.deepEqual(
    results.map((r) => r.key),
    ["bfs", "dijkstra", "astar", "greedy", "bidirectional"]
  );
});

test("every algorithm agrees on step count for an open unweighted grid", () => {
  const grid = createGrid(5, 5);
  const results = compareAlgorithms(grid, { row: 0, col: 0 }, { row: 4, col: 4 });
  for (const result of results) {
    assert.equal(result.found, true, `${result.label} should find a path`);
    assert.equal(result.steps, 8, `${result.label} should take the Manhattan-distance 8 steps`);
    assert.equal(result.cost, 8, `${result.label} should pay unit cost per step on an unweighted grid`);
  }
});

test("compareAlgorithms reports found: false and null steps/cost for every algorithm when unreachable", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: "wall", weight: 1 };
  grid[1][0] = { type: "wall", weight: 1 };
  grid[1][1] = { type: "wall", weight: 1 };
  const results = compareAlgorithms(grid, { row: 2, col: 2 }, { row: 0, col: 0 });
  for (const result of results) {
    assert.equal(result.found, false, `${result.label} should report unreachable`);
    assert.equal(result.steps, null);
    assert.equal(result.cost, null);
  }
});

test("dijkstra and astar find a cheaper path cost than bfs and greedy when terrain is weighted", () => {
  // A straight row is the fewest-steps route, but its middle cell is expensive; a detour
  // through row 1 costs less overall despite visiting more cells.
  let grid = createGrid(2, 5);
  grid = setNodeWeight(grid, 0, 2, 100);
  const results = compareAlgorithms(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
  const byKey = Object.fromEntries(results.map((r) => [r.key, r]));

  assert.equal(byKey.bfs.steps, 4, "bfs ignores weight and takes the straight-line step count");
  assert.ok(byKey.dijkstra.cost < byKey.bfs.cost, "dijkstra should find a cheaper total cost than bfs's straight line");
  assert.ok(byKey.astar.cost < byKey.bfs.cost, "astar should find a cheaper total cost than bfs's straight line");
  assert.equal(byKey.dijkstra.cost, byKey.astar.cost, "dijkstra and astar should agree on the optimal cost");
});

test("pathCost sums every cell's weight except the first", () => {
  let grid = createGrid(1, 4);
  grid = setNodeWeight(grid, 0, 0, 999); // the start's own weight must not count
  grid = setNodeWeight(grid, 0, 1, 5);
  grid = setNodeWeight(grid, 0, 3, 100);
  const path = [0, 1, 2, 3].map((col) => ({ row: 0, col }));
  // Cost is grid[0][1].weight + grid[0][2].weight + grid[0][3].weight = 5 + 1 + 100.
  assert.equal(pathCost(grid, path), 106);
});

test("pathCost is 0 for a path with zero or one cells", () => {
  const grid = createGrid(3, 3);
  assert.equal(pathCost(grid, []), 0);
  assert.equal(pathCost(grid, [{ row: 1, col: 1 }]), 0);
});
