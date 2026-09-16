import test from "node:test";
import assert from "node:assert/strict";
import { generateMaze, generateMazePrim, generateMazeKruskal } from "../src/maze.js";

// A small seeded PRNG (mulberry32) so maze generation tests are deterministic and reproducible
// across runs, instead of depending on Math.random.
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

function floodFillPassages(wallGrid, startRow, startCol) {
  const rows = wallGrid.length;
  const cols = wallGrid[0].length;
  const seen = new Set([`${startRow},${startCol}`]);
  const stack = [[startRow, startCol]];

  while (stack.length > 0) {
    const [row, col] = stack.pop();
    for (const [dRow, dCol] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nextRow = row + dRow;
      const nextCol = col + dCol;
      const key = `${nextRow},${nextCol}`;
      if (
        nextRow >= 0 &&
        nextRow < rows &&
        nextCol >= 0 &&
        nextCol < cols &&
        !wallGrid[nextRow][nextCol] &&
        !seen.has(key)
      ) {
        seen.add(key);
        stack.push([nextRow, nextCol]);
      }
    }
  }

  return seen;
}

test("generateMaze returns a grid of the requested dimensions", () => {
  const maze = generateMaze(7, 11, mulberry32(1));
  assert.equal(maze.length, 7);
  for (const row of maze) assert.equal(row.length, 11);
});

test("generateMaze's start cell (0, 0) is always a passage", () => {
  const maze = generateMaze(9, 9, mulberry32(2));
  assert.equal(maze[0][0], false);
});

test("generateMaze connects every even-indexed cell to the start — a maze with no isolated rooms", () => {
  const rows = 9;
  const cols = 15;
  const maze = generateMaze(rows, cols, mulberry32(3));
  const reachable = floodFillPassages(maze, 0, 0);

  for (let row = 0; row < rows; row += 2) {
    for (let col = 0; col < cols; col += 2) {
      assert.ok(reachable.has(`${row},${col}`), `expected (${row},${col}) to be reachable`);
    }
  }
});

test("generateMaze is deterministic for a given random source", () => {
  const mazeA = generateMaze(9, 9, mulberry32(42));
  const mazeB = generateMaze(9, 9, mulberry32(42));
  assert.deepEqual(mazeA, mazeB);
});

test("generateMaze produces a different maze for a different random source", () => {
  const mazeA = generateMaze(11, 11, mulberry32(1));
  const mazeB = generateMaze(11, 11, mulberry32(2));
  assert.notDeepEqual(mazeA, mazeB);
});

test("generateMaze never mutates its randomFn's expected call pattern (pure output for pure input)", () => {
  // Every cell is either true or false — no undefined holes from an off-by-one in the carve.
  const maze = generateMaze(6, 6, mulberry32(7));
  for (const row of maze) {
    for (const cell of row) {
      assert.equal(typeof cell, "boolean");
    }
  }
});

test("generateMazePrim returns a grid of the requested dimensions", () => {
  const maze = generateMazePrim(7, 11, mulberry32(1));
  assert.equal(maze.length, 7);
  for (const row of maze) assert.equal(row.length, 11);
});

test("generateMazePrim's start cell (0, 0) is always a passage", () => {
  const maze = generateMazePrim(9, 9, mulberry32(2));
  assert.equal(maze[0][0], false);
});

test("generateMazePrim connects every even-indexed cell to the start — a maze with no isolated rooms", () => {
  const rows = 9;
  const cols = 15;
  const maze = generateMazePrim(rows, cols, mulberry32(3));
  const reachable = floodFillPassages(maze, 0, 0);

  for (let row = 0; row < rows; row += 2) {
    for (let col = 0; col < cols; col += 2) {
      assert.ok(reachable.has(`${row},${col}`), `expected (${row},${col}) to be reachable`);
    }
  }
});

test("generateMazePrim is a perfect maze — exactly one path between any two passages, so exactly one wall is carved per newly-visited cell", () => {
  // A perfect maze on N even-cell passages has exactly N-1 carved connecting walls (a spanning
  // tree); more would mean a cycle, fewer would mean a disconnected passage.
  const rows = 9;
  const cols = 9;
  const maze = generateMazePrim(rows, cols, mulberry32(11));
  let passageCount = 0;
  let oddWallsCarved = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isEvenCell = row % 2 === 0 && col % 2 === 0;
      if (isEvenCell) {
        passageCount++;
      } else if (!maze[row][col]) {
        oddWallsCarved++;
      }
    }
  }
  assert.equal(oddWallsCarved, passageCount - 1);
});

test("generateMazePrim is deterministic for a given random source", () => {
  const mazeA = generateMazePrim(9, 9, mulberry32(42));
  const mazeB = generateMazePrim(9, 9, mulberry32(42));
  assert.deepEqual(mazeA, mazeB);
});

test("generateMazePrim produces a different maze for a different random source", () => {
  const mazeA = generateMazePrim(11, 11, mulberry32(1));
  const mazeB = generateMazePrim(11, 11, mulberry32(2));
  assert.notDeepEqual(mazeA, mazeB);
});

test("generateMazePrim produces a different texture than the recursive backtracker for the same seed", () => {
  const backtracker = generateMaze(11, 11, mulberry32(5));
  const prim = generateMazePrim(11, 11, mulberry32(5));
  assert.notDeepEqual(backtracker, prim);
});

test("generateMazeKruskal returns a grid of the requested dimensions", () => {
  const maze = generateMazeKruskal(7, 11, mulberry32(1));
  assert.equal(maze.length, 7);
  for (const row of maze) assert.equal(row.length, 11);
});

test("generateMazeKruskal's start cell (0, 0) is always a passage", () => {
  const maze = generateMazeKruskal(9, 9, mulberry32(2));
  assert.equal(maze[0][0], false);
});

test("generateMazeKruskal connects every even-indexed cell to the start — a maze with no isolated rooms", () => {
  const rows = 9;
  const cols = 15;
  const maze = generateMazeKruskal(rows, cols, mulberry32(3));
  const reachable = floodFillPassages(maze, 0, 0);

  for (let row = 0; row < rows; row += 2) {
    for (let col = 0; col < cols; col += 2) {
      assert.ok(reachable.has(`${row},${col}`), `expected (${row},${col}) to be reachable`);
    }
  }
});

test("generateMazeKruskal is a perfect maze — exactly one path between any two passages, so exactly one wall is carved per newly-visited cell", () => {
  const rows = 9;
  const cols = 9;
  const maze = generateMazeKruskal(rows, cols, mulberry32(11));
  let passageCount = 0;
  let oddWallsCarved = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isEvenCell = row % 2 === 0 && col % 2 === 0;
      if (isEvenCell) {
        passageCount++;
      } else if (!maze[row][col]) {
        oddWallsCarved++;
      }
    }
  }
  assert.equal(oddWallsCarved, passageCount - 1);
});

test("generateMazeKruskal is deterministic for a given random source", () => {
  const mazeA = generateMazeKruskal(9, 9, mulberry32(42));
  const mazeB = generateMazeKruskal(9, 9, mulberry32(42));
  assert.deepEqual(mazeA, mazeB);
});

test("generateMazeKruskal produces a different maze for a different random source", () => {
  const mazeA = generateMazeKruskal(11, 11, mulberry32(1));
  const mazeB = generateMazeKruskal(11, 11, mulberry32(2));
  assert.notDeepEqual(mazeA, mazeB);
});

test("generateMazeKruskal produces a different texture than the backtracker or Prim's for the same seed", () => {
  const backtracker = generateMaze(11, 11, mulberry32(5));
  const prim = generateMazePrim(11, 11, mulberry32(5));
  const kruskal = generateMazeKruskal(11, 11, mulberry32(5));
  assert.notDeepEqual(backtracker, kruskal);
  assert.notDeepEqual(prim, kruskal);
});

test("generateMazeKruskal handles a single-row or single-column grid without an out-of-bounds edge", () => {
  assert.doesNotThrow(() => generateMazeKruskal(1, 9, mulberry32(1)));
  assert.doesNotThrow(() => generateMazeKruskal(9, 1, mulberry32(1)));
});
