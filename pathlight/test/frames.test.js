import test from "node:test";
import assert from "node:assert/strict";
import { totalFrames, frameState } from "../src/frames.js";

const visitedOrder = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
];
const path = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
];

test("totalFrames counts every visited cell plus every path cell when found", () => {
  assert.equal(totalFrames(visitedOrder, path, true), 6);
});

test("totalFrames ignores the path when no path was found", () => {
  assert.equal(totalFrames(visitedOrder, path, false), 3);
});

test("frameState at 0 reveals nothing", () => {
  assert.deepEqual(frameState(visitedOrder, path, true, 0), { visited: [], path: [] });
});

test("frameState mid-way through the visited order reveals only that prefix, no path yet", () => {
  assert.deepEqual(frameState(visitedOrder, path, true, 2), {
    visited: [visitedOrder[0], visitedOrder[1]],
    path: [],
  });
});

test("frameState once every cell is visited reveals the full visited set and starts the path", () => {
  assert.deepEqual(frameState(visitedOrder, path, true, 4), {
    visited: visitedOrder,
    path: [path[0]],
  });
});

test("frameState at the total reveals everything", () => {
  assert.deepEqual(frameState(visitedOrder, path, true, 6), { visited: visitedOrder, path });
});

test("frameState clamps an index past the total", () => {
  assert.deepEqual(frameState(visitedOrder, path, true, 999), { visited: visitedOrder, path });
});

test("frameState clamps a negative index to 0", () => {
  assert.deepEqual(frameState(visitedOrder, path, true, -5), { visited: [], path: [] });
});

test("frameState never reveals a path when no path was found, even past visitedOrder's length", () => {
  assert.deepEqual(frameState(visitedOrder, path, false, 999), { visited: visitedOrder, path: [] });
});
