import test from "node:test";
import assert from "node:assert/strict";
import {
  findBodyAtPoint,
  speed,
  kineticEnergy,
  describeBody,
  adjacentBodyId,
  removeBody,
} from "../src/inspector.js";

function threeBodies() {
  return [
    { id: 1, mass: 10, x: 0, y: 0, vx: 3, vy: 4, radius: 5 },
    { id: 2, mass: 20, x: 100, y: 0, vx: 0, vy: 0, radius: 8 },
    { id: 3, mass: 30, x: 100, y: 5, vx: -1, vy: 0, radius: 3 },
  ];
}

test("findBodyAtPoint returns the body whose disc contains the point", () => {
  const bodies = threeBodies();
  assert.equal(findBodyAtPoint(bodies, 1, 1)?.id, 1);
});

test("findBodyAtPoint returns null when no disc contains the point", () => {
  const bodies = threeBodies();
  assert.equal(findBodyAtPoint(bodies, 500, 500), null);
});

test("findBodyAtPoint prefers the closest center when discs overlap", () => {
  const bodies = threeBodies();
  // (100, 3) is within both body 2's and body 3's radius, but closer to body 3.
  assert.equal(findBodyAtPoint(bodies, 100, 3)?.id, 3);
});

test("speed is the magnitude of the velocity vector", () => {
  assert.equal(speed({ vx: 3, vy: 4 }), 5);
  assert.equal(speed({ vx: 0, vy: 0 }), 0);
});

test("kineticEnergy matches 1/2 m v^2", () => {
  assert.equal(kineticEnergy({ mass: 10, vx: 3, vy: 4 }), 0.5 * 10 * 25);
});

test("describeBody reports id, position, speed, and kinetic energy", () => {
  const described = describeBody({ id: 7, mass: 2, x: 1, y: 2, vx: 3, vy: 4 });
  assert.deepEqual(described, {
    id: 7,
    mass: 2,
    x: 1,
    y: 2,
    speed: 5,
    kineticEnergy: 0.5 * 2 * 25,
  });
});

test("adjacentBodyId with no current selection starts at the first body going forward", () => {
  const bodies = threeBodies();
  assert.equal(adjacentBodyId(bodies, null, 1), 1);
});

test("adjacentBodyId with no current selection starts at the last body going backward", () => {
  const bodies = threeBodies();
  assert.equal(adjacentBodyId(bodies, null, -1), 3);
});

test("adjacentBodyId steps forward and wraps around", () => {
  const bodies = threeBodies();
  assert.equal(adjacentBodyId(bodies, 1, 1), 2);
  assert.equal(adjacentBodyId(bodies, 3, 1), 1);
});

test("adjacentBodyId steps backward and wraps around", () => {
  const bodies = threeBodies();
  assert.equal(adjacentBodyId(bodies, 2, -1), 1);
  assert.equal(adjacentBodyId(bodies, 1, -1), 3);
});

test("adjacentBodyId falls back to an edge body when the current id is gone", () => {
  const bodies = threeBodies();
  assert.equal(adjacentBodyId(bodies, 999, 1), 1);
  assert.equal(adjacentBodyId(bodies, 999, -1), 3);
});

test("adjacentBodyId returns null when there are no bodies", () => {
  assert.equal(adjacentBodyId([], 1, 1), null);
});

test("removeBody drops the matching body and leaves the others in order", () => {
  const bodies = threeBodies();
  const result = removeBody(bodies, 2);
  assert.deepEqual(
    result.map((b) => b.id),
    [1, 3]
  );
});

test("removeBody does not mutate the array passed in", () => {
  const bodies = threeBodies();
  removeBody(bodies, 2);
  assert.deepEqual(
    bodies.map((b) => b.id),
    [1, 2, 3]
  );
});

test("removeBody returns the same array reference when the id is not found", () => {
  const bodies = threeBodies();
  assert.equal(removeBody(bodies, 999), bodies);
});

test("removeBody on the last remaining body returns an empty array", () => {
  const bodies = [{ id: 1, mass: 10, x: 0, y: 0, vx: 0, vy: 0, radius: 5 }];
  assert.deepEqual(removeBody(bodies, 1), []);
});
