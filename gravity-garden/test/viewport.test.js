import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  createViewport,
  worldToScreen,
  screenToWorld,
  panBy,
  zoomAt,
  resetViewport,
} from "../src/viewport.js";

const W = 800;
const H = 600;

test("createViewport starts centered with no zoom", () => {
  assert.deepEqual(createViewport(), { panX: 0, panY: 0, zoom: 1 });
});

test("worldToScreen maps the world origin to the canvas center by default", () => {
  const { sx, sy } = worldToScreen(createViewport(), W, H, 0, 0);
  assert.equal(sx, W / 2);
  assert.equal(sy, H / 2);
});

test("screenToWorld is the inverse of worldToScreen for an arbitrary viewport", () => {
  const viewport = { panX: 37, panY: -12, zoom: 2.5 };
  const original = { x: 91, y: -44 };
  const { sx, sy } = worldToScreen(viewport, W, H, original.x, original.y);
  const back = screenToWorld(viewport, W, H, sx, sy);
  assert.ok(Math.abs(back.x - original.x) < 1e-9);
  assert.ok(Math.abs(back.y - original.y) < 1e-9);
});

test("zoom scales distance from the canvas center", () => {
  const viewport = { panX: 0, panY: 0, zoom: 2 };
  const { sx, sy } = worldToScreen(viewport, W, H, 10, 0);
  assert.equal(sx, W / 2 + 20);
  assert.equal(sy, H / 2);
});

test("panBy keeps the same world point under a screen point that moved with the drag", () => {
  const viewport = { panX: 0, panY: 0, zoom: 1.5 };
  const worldBefore = screenToWorld(viewport, W, H, 400, 300);

  const dragged = panBy(viewport, 20, -10);
  const worldAfter = screenToWorld(dragged, W, H, 420, 290);

  assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 1e-9);
  assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 1e-9);
});

test("zoomAt keeps the world point under the cursor fixed on screen", () => {
  const viewport = { panX: 5, panY: -8, zoom: 1 };
  const sx = 550;
  const sy = 200;
  const worldUnderCursor = screenToWorld(viewport, W, H, sx, sy);

  const zoomed = zoomAt(viewport, W, H, sx, sy, 2);
  const worldUnderCursorAfter = screenToWorld(zoomed, W, H, sx, sy);

  assert.ok(Math.abs(worldUnderCursorAfter.x - worldUnderCursor.x) < 1e-9);
  assert.ok(Math.abs(worldUnderCursorAfter.y - worldUnderCursor.y) < 1e-9);
  assert.equal(zoomed.zoom, 2);
});

test("zoomAt clamps to MIN_ZOOM and MAX_ZOOM", () => {
  const tooFarOut = zoomAt(createViewport(), W, H, 400, 300, 1e-6);
  assert.equal(tooFarOut.zoom, MIN_ZOOM);

  const tooFarIn = zoomAt(createViewport(), W, H, 400, 300, 1e6);
  assert.equal(tooFarIn.zoom, MAX_ZOOM);
});

test("resetViewport returns a fresh default viewport", () => {
  assert.deepEqual(resetViewport(), { panX: 0, panY: 0, zoom: 1 });
});
