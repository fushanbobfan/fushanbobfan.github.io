import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAccelerations,
  stepSimulation,
  totalMomentum,
  totalEnergy,
  centerOfMass,
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
