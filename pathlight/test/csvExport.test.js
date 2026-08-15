import test from "node:test";
import assert from "node:assert/strict";
import { compareResultsToCsv } from "../src/csvExport.js";

function result(overrides) {
  return { key: "bfs", label: "Breadth-First Search", visitedCount: 10, found: true, steps: 8, cost: 8, ...overrides };
}

test("compareResultsToCsv starts with the expected header row", () => {
  const csv = compareResultsToCsv([]);
  assert.equal(csv, "Algorithm,Cells explored,Steps,Cost\r\n");
});

test("compareResultsToCsv writes one row per result, in order", () => {
  const csv = compareResultsToCsv([
    result({ label: "Breadth-First Search", visitedCount: 12, steps: 8, cost: 8 }),
    result({ label: "Dijkstra's Algorithm", visitedCount: 15, steps: 8, cost: 6 }),
  ]);
  const lines = csv.split("\r\n").filter(Boolean);
  assert.equal(lines.length, 3);
  assert.equal(lines[1], "Breadth-First Search,12,8,8");
  assert.equal(lines[2], "Dijkstra's Algorithm,15,8,6");
});

test("compareResultsToCsv reports unreachable steps/cost as the text 'unreachable', not null", () => {
  const csv = compareResultsToCsv([result({ found: false, steps: null, cost: null })]);
  const [, row] = csv.split("\r\n");
  assert.equal(row, "Breadth-First Search,10,unreachable,unreachable");
});

test("compareResultsToCsv quotes a field containing a comma", () => {
  const csv = compareResultsToCsv([result({ label: "A* Search, weighted" })]);
  const [, row] = csv.split("\r\n");
  assert.ok(row.startsWith('"A* Search, weighted",'));
});

test("compareResultsToCsv quotes and doubles an embedded double quote", () => {
  const csv = compareResultsToCsv([result({ label: 'The "greedy" one' })]);
  const [, row] = csv.split("\r\n");
  assert.ok(row.startsWith('"The ""greedy"" one",'));
});

test("compareResultsToCsv leaves an ordinary field unquoted", () => {
  const csv = compareResultsToCsv([result({ label: "Breadth-First Search" })]);
  const [, row] = csv.split("\r\n");
  assert.ok(row.startsWith("Breadth-First Search,"));
});

test("compareResultsToCsv ends with a trailing CRLF after the last row", () => {
  const csv = compareResultsToCsv([result()]);
  assert.ok(csv.endsWith("\r\n"));
  assert.equal(csv.split("\r\n").filter(Boolean).length, 2);
});
