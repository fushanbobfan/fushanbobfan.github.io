import test from "node:test";
import assert from "node:assert/strict";
import { serializeGrid, deserializeGrid, FORMAT_VERSION } from "../src/serialize.js";
import { createGrid, setNodeType, setNodeWeight, EMPTY, WALL, START, END } from "../src/grid.js";

test("serializeGrid records the format version, dimensions, and cells", () => {
  const grid = createGrid(2, 3);
  const serialized = serializeGrid(grid);
  assert.equal(serialized.version, FORMAT_VERSION);
  assert.equal(serialized.rows, 2);
  assert.equal(serialized.cols, 3);
  assert.deepEqual(serialized.cells[0][0], [EMPTY, 1]);
});

test("serializeGrid then deserializeGrid round-trips an edited grid exactly", () => {
  let grid = createGrid(3, 3);
  grid = setNodeType(grid, 0, 0, START);
  grid = setNodeType(grid, 2, 2, END);
  grid = setNodeType(grid, 1, 1, WALL);
  grid = setNodeWeight(grid, 0, 1, 5);

  const restored = deserializeGrid(serializeGrid(grid), 3, 3);
  assert.deepEqual(restored, grid);
});

test("deserializeGrid rejects a non-object", () => {
  assert.throws(() => deserializeGrid(null, 2, 2), /expected a JSON object/);
  assert.throws(() => deserializeGrid("nope", 2, 2), /expected a JSON object/);
});

test("deserializeGrid rejects a size mismatch", () => {
  const serialized = serializeGrid(createGrid(2, 2));
  assert.throws(() => deserializeGrid(serialized, 3, 3), /size mismatch/);
});

test("deserializeGrid rejects a row with the wrong number of cells", () => {
  const serialized = serializeGrid(createGrid(2, 2));
  serialized.cells[0] = [[EMPTY, 1]]; // only one cell instead of two
  assert.throws(() => deserializeGrid(serialized, 2, 2), /row 0 must have 2 cell/);
});

test("deserializeGrid rejects an unknown cell type", () => {
  const serialized = serializeGrid(createGrid(2, 2));
  serialized.cells[0][0] = ["lava", 1];
  assert.throws(() => deserializeGrid(serialized, 2, 2), /unknown type "lava"/);
});

test("deserializeGrid rejects a non-positive or non-finite weight", () => {
  const zero = serializeGrid(createGrid(2, 2));
  zero.cells[0][0] = [EMPTY, 0];
  assert.throws(() => deserializeGrid(zero, 2, 2), /invalid weight/);

  const infinite = serializeGrid(createGrid(2, 2));
  infinite.cells[0][0] = [EMPTY, Infinity];
  assert.throws(() => deserializeGrid(infinite, 2, 2), /invalid weight/);
});

test("deserializeGrid rejects more than one start or end cell", () => {
  const twoStarts = serializeGrid(createGrid(2, 2));
  twoStarts.cells[0][0] = [START, 1];
  twoStarts.cells[1][1] = [START, 1];
  assert.throws(() => deserializeGrid(twoStarts, 2, 2), /more than one start/);

  const twoEnds = serializeGrid(createGrid(2, 2));
  twoEnds.cells[0][0] = [END, 1];
  twoEnds.cells[1][1] = [END, 1];
  assert.throws(() => deserializeGrid(twoEnds, 2, 2), /more than one end/);
});

test("deserializeGrid rejects a malformed cell entry", () => {
  const serialized = serializeGrid(createGrid(2, 2));
  serialized.cells[0][0] = [EMPTY]; // missing weight
  assert.throws(() => deserializeGrid(serialized, 2, 2), /malformed/);
});
