import test from "node:test";
import assert from "node:assert/strict";
import { arrowLength, computeVelocityArrow } from "../src/velocityVectors.js";

test("arrowLength clamps a stationary body to the minimum length", () => {
  assert.equal(arrowLength(0, 1, 5, 50), 5);
});

test("arrowLength clamps an extreme speed to the maximum length", () => {
  assert.equal(arrowLength(1e9, 1, 5, 50), 50);
});

test("arrowLength grows with speed but sub-linearly (sqrt scaling)", () => {
  const slow = arrowLength(4, 1, 0, 1000);
  const fast = arrowLength(16, 1, 0, 1000);
  // Speed quadrupled (4 -> 16); sqrt scaling should only double the length (2 -> 4).
  assert.equal(slow, 2);
  assert.equal(fast, 4);
  assert.ok(fast < slow * 4, "sqrt scaling should grow slower than linear");
});

test("arrowLength scales linearly with the scale multiplier", () => {
  assert.equal(arrowLength(9, 2, 0, 1000), arrowLength(9, 1, 0, 1000) * 2);
});

test("arrowLength treats non-finite or negative speed as zero", () => {
  assert.equal(arrowLength(NaN, 1, 3, 50), 3);
  assert.equal(arrowLength(-5, 1, 3, 50), 3);
  assert.equal(arrowLength(Infinity, 1, 3, 50), 3);
});

test("computeVelocityArrow starts the shaft at the body's own position", () => {
  const arrow = computeVelocityArrow({ x: 10, y: -4, vx: 3, vy: 0 }, 1, 0, 1000);
  assert.equal(arrow.x1, 10);
  assert.equal(arrow.y1, -4);
});

test("computeVelocityArrow points the shaft in the direction of travel", () => {
  const right = computeVelocityArrow({ x: 0, y: 0, vx: 5, vy: 0 }, 1, 0, 1000);
  assert.ok(right.x2 > right.x1);
  assert.ok(Math.abs(right.y2 - right.y1) < 1e-9);

  const up = computeVelocityArrow({ x: 0, y: 0, vx: 0, vy: 5 }, 1, 0, 1000);
  assert.ok(up.y2 > up.y1);
  assert.ok(Math.abs(up.x2 - up.x1) < 1e-9);
});

test("computeVelocityArrow reports the body's speed", () => {
  const arrow = computeVelocityArrow({ x: 0, y: 0, vx: 3, vy: 4 }, 1, 0, 1000);
  assert.equal(arrow.speed, 5);
});

test("computeVelocityArrow gives a stationary body a zero-length shaft when minLength is 0", () => {
  const arrow = computeVelocityArrow({ x: 2, y: 2, vx: 0, vy: 0 }, 1, 0, 1000);
  assert.equal(arrow.x2, 2);
  assert.equal(arrow.y2, 2);
});

test("computeVelocityArrow treats a missing/non-finite velocity component as zero rather than throwing", () => {
  const arrow = computeVelocityArrow({ x: 0, y: 0, vx: NaN, vy: 4 }, 1, 0, 1000);
  assert.equal(arrow.speed, 4);
});
