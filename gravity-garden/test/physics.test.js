import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAccelerations,
  stepSimulation,
  totalMomentum,
  totalEnergy,
  centerOfMass,
  mergeCollidingBodies,
} from "../src/physics.js";

function twoBodySystem() {
  return [
    { mass: 100, x: -10, y: 0, vx: 0, vy: -0.5 },
    { mass: 100, x: 10, y: 0, vx: 0, vy: 0.5 },
  ];
}

test("accelerations on a two-body system are equal and opposite (Newton's third law)", () => {
  const bodies = twoBodySystem();
  const [a0, a1] = computeAccelerations(bodies, 1);

  assert.ok(Math.abs(a0.ax + a1.ax) < 1e-12);
  assert.ok(Math.abs(a0.ay + a1.ay) < 1e-12);
  // Equal masses pulling toward each other along the x-axis.
  assert.ok(a0.ax > 0, "body 0 should accelerate toward body 1 (+x)");
  assert.ok(a1.ax < 0, "body 1 should accelerate toward body 0 (-x)");
});

test("an isolated body feels no acceleration", () => {
  const bodies = [{ mass: 50, x: 0, y: 0, vx: 1, vy: -1 }];
  const [a0] = computeAccelerations(bodies, 1);
  assert.equal(a0.ax, 0);
  assert.equal(a0.ay, 0);
});

test("stepSimulation conserves total momentum for an isolated two-body system", () => {
  const bodies = twoBodySystem();
  const before = totalMomentum(bodies);

  for (let i = 0; i < 500; i++) {
    stepSimulation(bodies, 0.02, 1);
  }

  const after = totalMomentum(bodies);
  assert.ok(Math.abs(after.px - before.px) < 1e-6);
  assert.ok(Math.abs(after.py - before.py) < 1e-6);
});

test("stepSimulation approximately conserves total energy over many small steps", () => {
  const bodies = twoBodySystem();
  const G = 1;
  const e0 = totalEnergy(bodies, G);

  for (let i = 0; i < 2000; i++) {
    stepSimulation(bodies, 0.01, G);
  }

  const e1 = totalEnergy(bodies, G);
  const drift = Math.abs((e1 - e0) / e0);
  assert.ok(drift < 0.01, `energy drift ${drift} should stay small over 2000 leapfrog steps`);
});

test("center of mass of a symmetric two-body system stays at the origin", () => {
  const bodies = twoBodySystem();
  for (let i = 0; i < 300; i++) {
    stepSimulation(bodies, 0.02, 1);
  }
  const com = centerOfMass(bodies);
  assert.ok(Math.abs(com.x) < 1e-6);
  assert.ok(Math.abs(com.y) < 1e-6);
});

test("softening keeps acceleration finite even when two bodies coincide", () => {
  const bodies = [
    { mass: 100, x: 5, y: 5, vx: 0, vy: 0 },
    { mass: 100, x: 5, y: 5, vx: 0, vy: 0 },
  ];
  const [a0] = computeAccelerations(bodies, 1, 0.05);
  assert.ok(Number.isFinite(a0.ax));
  assert.ok(Number.isFinite(a0.ay));
});

test("mergeCollidingBodies leaves separated bodies untouched", () => {
  const bodies = [
    { mass: 10, x: 0, y: 0, vx: 1, vy: 0, radius: 3, color: "a" },
    { mass: 10, x: 100, y: 0, vx: -1, vy: 0, radius: 3, color: "b" },
  ];
  const result = mergeCollidingBodies(bodies);
  assert.equal(result.length, 2);
});

test("mergeCollidingBodies combines overlapping bodies, conserving mass and momentum", () => {
  const bodies = [
    { mass: 10, x: 0, y: 0, vx: 2, vy: 0, radius: 5, color: "a" },
    { mass: 30, x: 4, y: 0, vx: -1, vy: 1, radius: 5, color: "b" },
  ];
  const beforeMomentum = totalMomentum(bodies);

  const result = mergeCollidingBodies(bodies);

  assert.equal(result.length, 1);
  const merged = result[0];
  assert.equal(merged.mass, 40);

  const afterMomentum = totalMomentum(result);
  assert.ok(Math.abs(afterMomentum.px - beforeMomentum.px) < 1e-9);
  assert.ok(Math.abs(afterMomentum.py - beforeMomentum.py) < 1e-9);

  // Heavier body's color should win.
  assert.equal(merged.color, "b");
  // Radius grows (area-conserving in 2D) but stays smaller than the naive sum.
  assert.ok(merged.radius > 5 && merged.radius < 10);
});

test("mergeCollidingBodies resolves a chain of three overlapping bodies into one", () => {
  const bodies = [
    { mass: 10, x: 0, y: 0, vx: 0, vy: 0, radius: 5, color: "a" },
    { mass: 10, x: 6, y: 0, vx: 0, vy: 0, radius: 5, color: "b" },
    { mass: 10, x: 12, y: 0, vx: 0, vy: 0, radius: 5, color: "c" },
  ];
  const result = mergeCollidingBodies(bodies);
  assert.equal(result.length, 1);
  assert.equal(result[0].mass, 30);
});

test("mergeCollidingBodies does not mutate its input", () => {
  const bodies = [
    { mass: 10, x: 0, y: 0, vx: 0, vy: 0, radius: 5, color: "a" },
    { mass: 10, x: 4, y: 0, vx: 0, vy: 0, radius: 5, color: "b" },
  ];
  mergeCollidingBodies(bodies);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].x, 0);
});
