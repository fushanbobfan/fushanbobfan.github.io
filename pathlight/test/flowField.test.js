import test from "node:test";
import assert from "node:assert/strict";
import { createGrid, setNodeType, setNodeWeight, START, END, WALL } from "../src/grid.js";
import { dijkstra } from "../src/algorithms/dijkstra.js";
import { computeFlowField, arrowBetween, followFlow } from "../src/flowField.js";

function open5x5() {
  let grid = createGrid(5, 5);
  grid = setNodeType(grid, 0, 0, START);
  grid = setNodeType(grid, 4, 4, END);
  return grid;
}

test("the end costs zero and its orthogonal neighbors cost the end's weight", () => {
  const field = computeFlowField(open5x5(), { row: 4, col: 4 });
  assert.equal(field.cost[4][4], 0);
  assert.equal(field.next[4][4], null);
  assert.equal(field.cost[3][4], 1);
  assert.equal(field.cost[4][3], 1);
  assert.deepEqual(field.next[3][4], { row: 4, col: 4 });
  assert.deepEqual(field.next[4][3], { row: 4, col: 4 });
});

test("on an open unit grid the cost is the Manhattan distance to the end", () => {
  const field = computeFlowField(open5x5(), { row: 4, col: 4 });
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      assert.equal(field.cost[r][c], 4 - r + (4 - c), `cell ${r},${c}`);
    }
  }
  assert.equal(field.maxCost, 8);
});

test("every arrow points to a neighbor with strictly lower cost", () => {
  let grid = open5x5();
  grid = setNodeType(grid, 1, 1, WALL);
  grid = setNodeType(grid, 2, 3, WALL);
  grid = setNodeWeight(grid, 3, 2, 5);
  const field = computeFlowField(grid, { row: 4, col: 4 });
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const to = field.next[r][c];
      if (!to) continue;
      assert.equal(Math.abs(to.row - r) + Math.abs(to.col - c), 1, "orthogonal step");
      assert.ok(field.cost[to.row][to.col] < field.cost[r][c], `descending at ${r},${c}`);
      assert.equal(field.cost[r][c], field.cost[to.row][to.col] + grid[to.row][to.col].weight);
    }
  }
});

test("walls and sealed-off cells are unreachable and have no arrow", () => {
  let grid = open5x5();
  for (let r = 0; r < 5; r++) grid = setNodeType(grid, r, 2, WALL);
  const field = computeFlowField(grid, { row: 4, col: 4 });
  assert.equal(field.cost[0][2], Infinity);
  assert.equal(field.next[0][2], null);
  assert.equal(field.cost[0][0], Infinity, "left side is sealed off");
  assert.equal(field.next[0][0], null);
  assert.equal(field.cost[0][4], 4, "right side still reaches the end");
});

test("following the arrows from any cell reproduces Dijkstra's cost to the end", () => {
  let grid = open5x5();
  grid = setNodeType(grid, 1, 1, WALL);
  grid = setNodeType(grid, 1, 2, WALL);
  grid = setNodeType(grid, 3, 1, WALL);
  grid = setNodeWeight(grid, 2, 2, 6);
  grid = setNodeWeight(grid, 2, 3, 6);
  const end = { row: 4, col: 4 };
  const field = computeFlowField(grid, end);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (grid[r][c].type === WALL) continue;
      const route = followFlow(field, { row: r, col: c });
      assert.deepEqual(route.at(-1), end, `route from ${r},${c} ends at the end`);
      const walked = route.slice(1).reduce((sum, cell) => sum + grid[cell.row][cell.col].weight, 0);
      assert.equal(walked, field.cost[r][c], `walked cost from ${r},${c}`);
      const forward = dijkstra(grid, { row: r, col: c }, end);
      const forwardCost = forward.path.slice(1).reduce((sum, cell) => sum + grid[cell.row][cell.col].weight, 0);
      assert.equal(walked, forwardCost, `agrees with forward Dijkstra from ${r},${c}`);
    }
  }
});

test("arrows detour around expensive terrain when the detour is cheaper", () => {
  let grid = createGrid(3, 3);
  grid = setNodeType(grid, 2, 2, END);
  grid = setNodeWeight(grid, 1, 2, 9); // straight down the right column is expensive
  const field = computeFlowField(grid, { row: 2, col: 2 });
  assert.deepEqual(field.next[0][2], { row: 0, col: 1 }, "steps left instead of into the weight");
  assert.equal(field.cost[0][2], 4);
});

test("arrowBetween names the direction of an orthogonal step", () => {
  assert.equal(arrowBetween({ row: 2, col: 2 }, { row: 1, col: 2 }), "↑");
  assert.equal(arrowBetween({ row: 2, col: 2 }, { row: 3, col: 2 }), "↓");
  assert.equal(arrowBetween({ row: 2, col: 2 }, { row: 2, col: 1 }), "←");
  assert.equal(arrowBetween({ row: 2, col: 2 }, { row: 2, col: 3 }), "→");
  assert.equal(arrowBetween({ row: 2, col: 2 }, null), "");
  assert.equal(arrowBetween({ row: 2, col: 2 }, { row: 2, col: 2 }), "");
});

test("a missing end or empty grid yields an all-Infinity field", () => {
  const field = computeFlowField(createGrid(2, 2), null);
  assert.deepEqual(field.cost, [[Infinity, Infinity], [Infinity, Infinity]]);
  assert.equal(field.maxCost, 0);
  const empty = computeFlowField([], { row: 0, col: 0 });
  assert.deepEqual(empty.cost, []);
});

test("followFlow terminates on a field that loops", () => {
  const field = { next: [[{ row: 0, col: 1 }, { row: 0, col: 0 }]], cost: [[1, 1]], maxCost: 1 };
  const route = followFlow(field, { row: 0, col: 0 });
  assert.ok(route.length <= 3);
});
