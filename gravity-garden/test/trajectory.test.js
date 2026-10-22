import test from "node:test";
import assert from "node:assert/strict";
import { predictTrajectory } from "../src/trajectory.js";

test("predictTrajectory returns one path per body, each with steps + 1 points", () => {
  const bodies = [
    { mass: 10, x: 0, y: 0, vx: 1, vy: 0 },
    { mass: 10, x: 50, y: 0, vx: 0, vy: 1 },
  ];
  const paths = predictTrajectory(bodies, 20, 0.1, 1, 4);

  assert.equal(paths.length, 2);
  for (const path of paths) {
    assert.equal(path.length, 21);
  }
});

test("the first point of every path is the body's current position", () => {
  const bodies = [
    { mass: 10, x: 3, y: -7, vx: 1, vy: 2 },
    { mass: 10, x: -40, y: 12, vx: 0, vy: 0 },
  ];
  const paths = predictTrajectory(bodies, 5, 0.1, 1, 4);

  assert.deepEqual(paths[0][0], { x: 3, y: -7 });
  assert.deepEqual(paths[1][0], { x: -40, y: 12 });
});

test("predictTrajectory does not mutate the bodies passed in", () => {
  const bodies = [{ mass: 10, x: 0, y: 0, vx: 5, vy: 5 }];
  predictTrajectory(bodies, 30, 0.1, 1, 4);

  assert.equal(bodies[0].x, 0);
  assert.equal(bodies[0].y, 0);
  assert.equal(bodies[0].vx, 5);
  assert.equal(bodies[0].vy, 5);
});

test("an isolated body (no other mass to attract it) is forecast in a straight line", () => {
  const bodies = [{ mass: 10, x: 0, y: 0, vx: 4, vy: -2 }];
  const steps = 10;
  const dt = 0.5;
  const paths = predictTrajectory(bodies, steps, dt, 1, 4);

  const last = paths[0][steps];
  assert.ok(Math.abs(last.x - 4 * dt * steps) < 1e-9);
  assert.ok(Math.abs(last.y - -2 * dt * steps) < 1e-9);
});

test("predictTrajectory with zero steps returns just the starting point", () => {
  const bodies = [{ mass: 10, x: 1, y: 2, vx: 0, vy: 0 }];
  const paths = predictTrajectory(bodies, 0, 0.1, 1, 4);

  assert.equal(paths[0].length, 1);
  assert.deepEqual(paths[0][0], { x: 1, y: 2 });
});
