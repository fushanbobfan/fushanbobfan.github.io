import test from "node:test";
import assert from "node:assert/strict";
import {
  accelerationArrowLength,
  computeAccelerationArrow,
} from "../src/accelerationVectors.js";

test("accelerationArrowLength clamps a body in no field to the minimum length", () => {
  assert.equal(accelerationArrowLength(0, 1, 5, 50), 5);
});

test("accelerationArrowLength clamps an extreme acceleration to the maximum length", () => {
  assert.equal(accelerationArrowLength(1e9, 1, 5, 50), 50);
});

test("accelerationArrowLength grows with magnitude but sub-linearly (sqrt scaling)", () => {
  const gentle = accelerationArrowLength(4, 1, 0, 1000);
  const strong = accelerationArrowLength(16, 1, 0, 1000);
  // Magnitude quadrupled (4 -> 16); sqrt scaling should only double the length (2 -> 4).
  assert.equal(gentle, 2);
  assert.equal(strong, 4);
  assert.ok(strong < gentle * 4, "sqrt scaling should grow slower than linear");
});

test("accelerationArrowLength scales linearly with the scale multiplier", () => {
  assert.equal(
    accelerationArrowLength(9, 2, 0, 1000),
    accelerationArrowLength(9, 1, 0, 1000) * 2,
  );
});

test("accelerationArrowLength treats non-finite or negative magnitude as zero", () => {
  assert.equal(accelerationArrowLength(NaN, 1, 3, 50), 3);
  assert.equal(accelerationArrowLength(-5, 1, 3, 50), 3);
  assert.equal(accelerationArrowLength(Infinity, 1, 3, 50), 3);
});

test("computeAccelerationArrow starts the shaft at the body's own position", () => {
  const arrow = computeAccelerationArrow({ x: 10, y: -4 }, 3, 0, 1, 0, 1000);
  assert.equal(arrow.x1, 10);
  assert.equal(arrow.y1, -4);
});

test("computeAccelerationArrow points the shaft along the net force", () => {
  const right = computeAccelerationArrow({ x: 0, y: 0 }, 5, 0, 1, 0, 1000);
  assert.ok(right.x2 > right.x1);
  assert.ok(Math.abs(right.y2 - right.y1) < 1e-9);

  const down = computeAccelerationArrow({ x: 0, y: 0 }, 0, 5, 1, 0, 1000);
  assert.ok(down.y2 > down.y1);
  assert.ok(Math.abs(down.x2 - down.x1) < 1e-9);
});

test("computeAccelerationArrow reports the acceleration magnitude", () => {
  const arrow = computeAccelerationArrow({ x: 0, y: 0 }, 3, 4, 1, 0, 1000);
  assert.equal(arrow.magnitude, 5);
});

test("computeAccelerationArrow gives a body in no field a zero-length shaft when minLength is 0", () => {
  const arrow = computeAccelerationArrow({ x: 2, y: 2 }, 0, 0, 1, 0, 1000);
  assert.equal(arrow.x2, 2);
  assert.equal(arrow.y2, 2);
});

test("computeAccelerationArrow treats a non-finite component as zero rather than throwing", () => {
  const arrow = computeAccelerationArrow({ x: 0, y: 0 }, NaN, 4, 1, 0, 1000);
  assert.equal(arrow.magnitude, 4);
});

test("a circular-orbit acceleration points across the velocity, not along it", () => {
  // Body moving +x, pulled toward a mass directly below it (-y): the two arrows
  // should be perpendicular. This is the case the feature exists to make visible.
  const body = { x: 0, y: 0 };
  const arrow = computeAccelerationArrow(body, 0, -10, 1, 0, 1000);
  assert.ok(arrow.y2 < arrow.y1, "acceleration points toward the attractor");
  assert.ok(Math.abs(arrow.x2 - arrow.x1) < 1e-9, "no component along the motion");
});
