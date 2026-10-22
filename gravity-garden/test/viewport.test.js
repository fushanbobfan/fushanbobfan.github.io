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
  touchDistance,
  touchMidpoint,
  frameBodies,
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

test("touchDistance measures the straight-line distance between two touch points", () => {
  assert.equal(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(touchDistance({ x: 10, y: 10 }, { x: 10, y: 10 }), 0);
});

test("touchMidpoint averages two touch points", () => {
  assert.deepEqual(touchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 }), { x: 5, y: 10 });
  assert.deepEqual(touchMidpoint({ x: -4, y: 6 }, { x: 4, y: -6 }), { x: 0, y: 0 });
});

test("spreading two touches to double their distance, via zoomAt, doubles the zoom", () => {
  const viewport = { panX: 0, panY: 0, zoom: 1 };
  const start = touchDistance({ x: 250, y: 300 }, { x: 550, y: 300 });
  const end = touchDistance({ x: 100, y: 300 }, { x: 700, y: 300 });
  const mid = touchMidpoint({ x: 100, y: 300 }, { x: 700, y: 300 });

  const zoomed = zoomAt(viewport, W, H, mid.x, mid.y, end / start);
  assert.ok(Math.abs(zoomed.zoom - 2) < 1e-9);
});

test("frameBodies with no bodies falls back to the default viewport", () => {
  assert.deepEqual(frameBodies([], W, H), resetViewport());
});

test("frameBodies centers the pan on the bodies' bounding box", () => {
  const bodies = [
    { x: -100, y: 0, radius: 5 },
    { x: 100, y: 40, radius: 5 },
  ];
  const framed = frameBodies(bodies, W, H);
  assert.equal(framed.panX, 0);
  assert.equal(framed.panY, 20);
});

test("frameBodies zooms out to fit a wide spread within the canvas, with padding to spare", () => {
  const bodies = [
    { x: -1000, y: 0, radius: 5 },
    { x: 1000, y: 0, radius: 5 },
  ];
  const framed = frameBodies(bodies, W, H);

  // The full 2000-unit spread (plus padding) must fit inside the 800px-wide canvas.
  const halfWidthOnScreen = 1000 * framed.zoom;
  assert.ok(halfWidthOnScreen < W / 2);
  assert.ok(framed.zoom < 1);
});

test("frameBodies on a single body centers on it and clamps zoom to MAX_ZOOM rather than zooming to its own tiny size", () => {
  const framed = frameBodies([{ x: 3, y: -7, radius: 2 }], W, H);
  assert.equal(framed.panX, 3);
  assert.equal(framed.panY, -7);
  assert.equal(framed.zoom, MAX_ZOOM);
});

test("frameBodies on a small but spread-out canvas stays below MAX_ZOOM using MIN_FRAME_EXTENT", () => {
  const framed = frameBodies([{ x: 0, y: 0, radius: 0 }], 40, 40);
  assert.ok(framed.zoom < MAX_ZOOM);
  assert.ok(framed.zoom > 1);
});

test("frameBodies clamps to MIN_ZOOM for an extremely wide spread", () => {
  const bodies = [
    { x: -1e6, y: 0, radius: 1 },
    { x: 1e6, y: 0, radius: 1 },
  ];
  const framed = frameBodies(bodies, W, H);
  assert.equal(framed.zoom, MIN_ZOOM);
});
