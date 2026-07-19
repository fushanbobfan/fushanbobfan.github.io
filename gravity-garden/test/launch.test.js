import test from "node:test";
import assert from "node:assert/strict";
import { LAUNCH_VELOCITY_SCALE, launchVelocityFrom } from "../src/launch.js";

test("dragging back over the body itself imparts zero velocity", () => {
  const { vx, vy } = launchVelocityFrom(10, -5, 10, -5);
  assert.equal(vx, 0);
  assert.equal(vy, 0);
});

test("velocity points from the body toward the pointer", () => {
  const { vx, vy } = launchVelocityFrom(0, 0, 100, 0, 1);
  assert.equal(vx, 100);
  assert.equal(vy, 0);

  const up = launchVelocityFrom(0, 0, 0, -50, 1);
  assert.equal(up.vx, 0);
  assert.equal(up.vy, -50);
});

test("dragging farther launches faster, proportionally", () => {
  const near = launchVelocityFrom(0, 0, 10, 0, 1);
  const far = launchVelocityFrom(0, 0, 40, 0, 1);
  assert.equal(far.vx, near.vx * 4);
});

test("the default scale is applied when none is passed explicitly", () => {
  const { vx, vy } = launchVelocityFrom(0, 0, 10, 20);
  assert.equal(vx, 10 * LAUNCH_VELOCITY_SCALE);
  assert.equal(vy, 20 * LAUNCH_VELOCITY_SCALE);
});

test("is independent of the body's absolute position, only the offset matters", () => {
  const a = launchVelocityFrom(0, 0, 10, 10, 1);
  const b = launchVelocityFrom(200, -300, 210, -290, 1);
  assert.deepEqual(a, b);
});
