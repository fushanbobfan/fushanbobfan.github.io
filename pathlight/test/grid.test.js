import test from "node:test";
import assert from "node:assert/strict";
import { createGrid, cloneGrid, neighbors, findNodeOfType, clearType, setNodeType, setNodeWeight, EMPTY, WALL, START, END } from "../src/grid.js";

test("createGrid makes a rows x cols grid of empty, unit-weight cells", () => {
  const grid = createGrid(2, 3);
  assert.equal(grid.length, 2);
  assert.equal(grid[0].length, 3);
  for (const row of grid) {
    for (const cell of row) {
      assert.deepEqual(cell, { type: EMPTY, weight: 1 });
    }
  }
});

test("cloneGrid produces an equal but independent copy", () => {
  const grid = createGrid(2, 2);
  const clone = cloneGrid(grid);
  clone[0][0].type = WALL;
  assert.equal(grid[0][0].type, EMPTY);
  assert.equal(clone[0][0].type, WALL);
});

test("neighbors returns only in-bounds, non-wall orthogonal cells", () => {
  const grid = createGrid(3, 3);
  grid[0][1] = { type: WALL, weight: 1 };
  const result = neighbors(grid, 0, 0);
  // (0,0)'s neighbors are (1,0) and (0,1); (0,1) is a wall, (-1,0) and (0,-1) are out of bounds.
  assert.deepEqual(
    result.sort((a, b) => a.row - b.row || a.col - b.col),
    [{ row: 1, col: 0 }]
  );
});

test("neighbors never returns diagonal cells", () => {
  const grid = createGrid(3, 3);
  const result = neighbors(grid, 1, 1);
  assert.equal(result.length, 4);
  for (const n of result) {
    const manhattan = Math.abs(n.row - 1) + Math.abs(n.col - 1);
    assert.equal(manhattan, 1);
  }
});

test("findNodeOfType finds the first cell of a type, or null if there isn't one", () => {
  const grid = createGrid(2, 2);
  assert.equal(findNodeOfType(grid, START), null);
  grid[1][0] = { type: START, weight: 1 };
  assert.deepEqual(findNodeOfType(grid, START), { row: 1, col: 0 });
});

test("clearType resets every cell of that type back to empty", () => {
  let grid = createGrid(2, 2);
  grid = setNodeType(grid, 0, 0, START);
  grid = clearType(grid, START);
  assert.equal(findNodeOfType(grid, START), null);
});

test("setNodeType moves START rather than creating a second one", () => {
  let grid = createGrid(2, 2);
  grid = setNodeType(grid, 0, 0, START);
  grid = setNodeType(grid, 1, 1, START);
  assert.equal(grid[0][0].type, EMPTY);
  assert.deepEqual(findNodeOfType(grid, START), { row: 1, col: 1 });
});

test("setNodeType placing END doesn't disturb an existing START", () => {
  let grid = createGrid(2, 2);
  grid = setNodeType(grid, 0, 0, START);
  grid = setNodeType(grid, 1, 1, END);
  assert.deepEqual(findNodeOfType(grid, START), { row: 0, col: 0 });
  assert.deepEqual(findNodeOfType(grid, END), { row: 1, col: 1 });
});

test("setNodeType does not mutate the grid passed in", () => {
  const grid = createGrid(2, 2);
  setNodeType(grid, 0, 0, WALL);
  assert.equal(grid[0][0].type, EMPTY);
});

test("setNodeWeight changes only the targeted cell's weight, leaving its type alone", () => {
  let grid = createGrid(2, 2);
  grid = setNodeWeight(grid, 0, 1, 5);
  assert.equal(grid[0][1].weight, 5);
  assert.equal(grid[0][1].type, EMPTY);
  assert.equal(grid[0][0].weight, 1);
});

test("setNodeWeight does not mutate the grid passed in", () => {
  const grid = createGrid(2, 2);
  setNodeWeight(grid, 0, 0, 5);
  assert.equal(grid[0][0].weight, 1);
});
