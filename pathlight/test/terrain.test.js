import test from "node:test";
import assert from "node:assert/strict";
import { generateTerrain } from "../src/terrain.js";

// The same seeded PRNG (mulberry32) used by maze.test.js, so terrain generation tests are
// deterministic and reproducible across runs instead of depending on Math.random.
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

test("generateTerrain returns a grid of the requested dimensions", () => {
  const terrain = generateTerrain(7, 11, mulberry32(1));
  assert.equal(terrain.length, 7);
  for (const row of terrain) assert.equal(row.length, 11);
});

test("generateTerrain keeps every weight within the requested [minWeight, maxWeight] range", () => {
  const terrain = generateTerrain(12, 12, mulberry32(2), { minWeight: 2, maxWeight: 6 });
  for (const row of terrain) {
    for (const weight of row) {
      assert.ok(weight >= 2 && weight <= 6, `expected ${weight} to be within [2, 6]`);
    }
  }
});

test("generateTerrain is deterministic for a given random source", () => {
  const terrainA = generateTerrain(9, 9, mulberry32(42));
  const terrainB = generateTerrain(9, 9, mulberry32(42));
  assert.deepEqual(terrainA, terrainB);
});

test("generateTerrain produces different terrain for a different random source", () => {
  const terrainA = generateTerrain(11, 11, mulberry32(1));
  const terrainB = generateTerrain(11, 11, mulberry32(2));
  assert.notDeepEqual(terrainA, terrainB);
});

test("generateTerrain with a single seed fills the whole grid with that seed's weight", () => {
  const terrain = generateTerrain(6, 6, mulberry32(5), { seedCount: 1, minWeight: 4, maxWeight: 4 });
  for (const row of terrain) {
    for (const weight of row) assert.equal(weight, 4);
  }
});

test("generateTerrain produces only integer weights", () => {
  const terrain = generateTerrain(8, 8, mulberry32(3));
  for (const row of terrain) {
    for (const weight of row) assert.ok(Number.isInteger(weight));
  }
});
