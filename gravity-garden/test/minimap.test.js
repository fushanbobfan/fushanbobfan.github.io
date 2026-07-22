import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBounds,
  computeMinimapTransform,
  worldToMinimapPoint,
  viewportRectOnMinimap,
} from "../src/minimap.js";

const W = 160;
const H = 120;

test("computeBounds returns null for an empty body list", () => {
  assert.equal(computeBounds([]), null);
});

test("computeBounds grows to include each body's radius, not just its center", () => {
  const bounds = computeBounds([{ x: 0, y: 0, radius: 5 }]);
  assert.deepEqual(bounds, { minX: -5, maxX: 5, minY: -5, maxY: 5 });
});

test("computeBounds spans every body", () => {
  const bounds = computeBounds([
    { x: -100, y: 10, radius: 2 },
    { x: 50, y: -30, radius: 3 },
  ]);
  assert.deepEqual(bounds, { minX: -102, maxX: 53, minY: -33, maxY: 12 });
});

test("computeMinimapTransform centers on a single body", () => {
  const transform = computeMinimapTransform([{ x: 7, y: -3, radius: 1 }], W, H);
  assert.equal(transform.centerX, 7);
  assert.equal(transform.centerY, -3);
  assert.ok(transform.scale > 0);
});

test("computeMinimapTransform on an empty body list centers on the origin with a default scale", () => {
  const transform = computeMinimapTransform([], W, H);
  assert.equal(transform.centerX, 0);
  assert.equal(transform.centerY, 0);
  assert.ok(transform.scale > 0);
});

test("worldToMinimapPoint maps a transform's own center to the minimap's center", () => {
  const transform = { scale: 2, centerX: 10, centerY: -5, width: W, height: H };
  const point = worldToMinimapPoint(transform, 10, -5);
  assert.equal(point.x, W / 2);
  assert.equal(point.y, H / 2);
});

test("worldToMinimapPoint scales distance from the transform's center", () => {
  const transform = { scale: 2, centerX: 0, centerY: 0, width: W, height: H };
  const point = worldToMinimapPoint(transform, 10, 0);
  assert.equal(point.x, W / 2 + 20);
  assert.equal(point.y, H / 2);
});

test("computeMinimapTransform fits a wide spread of bodies within the minimap's width", () => {
  const bodies = [
    { x: -1000, y: 0, radius: 1 },
    { x: 1000, y: 0, radius: 1 },
  ];
  const transform = computeMinimapTransform(bodies, W, H);
  const left = worldToMinimapPoint(transform, -1000, 0);
  const right = worldToMinimapPoint(transform, 1000, 0);
  assert.ok(left.x >= 0);
  assert.ok(right.x <= W);
});

test("viewportRectOnMinimap maps the visible world region to a rectangle on the minimap", () => {
  const transform = { scale: 1, centerX: 0, centerY: 0, width: W, height: H };
  const viewport = { panX: 0, panY: 0, zoom: 1 };
  const rect = viewportRectOnMinimap(transform, viewport, 800, 600);
  // At zoom 1 the visible world region is 800x600 world units, scaled by transform.scale (1).
  assert.ok(Math.abs(rect.width - 800) < 1e-9);
  assert.ok(Math.abs(rect.height - 600) < 1e-9);
  assert.ok(Math.abs(rect.x - (W / 2 - 400)) < 1e-9);
  assert.ok(Math.abs(rect.y - (H / 2 - 300)) < 1e-9);
});

test("viewportRectOnMinimap shrinks as the main viewport zooms in", () => {
  const transform = { scale: 1, centerX: 0, centerY: 0, width: W, height: H };
  const zoomedIn = viewportRectOnMinimap(transform, { panX: 0, panY: 0, zoom: 4 }, 800, 600);
  const zoomedOut = viewportRectOnMinimap(transform, { panX: 0, panY: 0, zoom: 1 }, 800, 600);
  assert.ok(zoomedIn.width < zoomedOut.width);
  assert.ok(zoomedIn.height < zoomedOut.height);
});
