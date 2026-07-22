// Pure pan/zoom transform between world space (the physics coordinate system,
// centered on the origin) and screen space (canvas pixels). Kept DOM-free,
// like physics.js and inspector.js, so the transform math can be tested
// without a canvas.

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 6;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createViewport() {
  return { panX: 0, panY: 0, zoom: 1 };
}

export function worldToScreen(viewport, canvasWidth, canvasHeight, x, y) {
  return {
    sx: canvasWidth / 2 + (x - viewport.panX) * viewport.zoom,
    sy: canvasHeight / 2 + (y - viewport.panY) * viewport.zoom,
  };
}

export function screenToWorld(viewport, canvasWidth, canvasHeight, sx, sy) {
  return {
    x: (sx - canvasWidth / 2) / viewport.zoom + viewport.panX,
    y: (sy - canvasHeight / 2) / viewport.zoom + viewport.panY,
  };
}

/**
 * Pans by a screen-space pixel delta, so dragging the pointer keeps the
 * content under it (rather than the delta itself being applied in world
 * units, which would pan faster than the mouse moves whenever zoomed in).
 */
export function panBy(viewport, dxScreen, dyScreen) {
  return {
    ...viewport,
    panX: viewport.panX - dxScreen / viewport.zoom,
    panY: viewport.panY - dyScreen / viewport.zoom,
  };
}

/**
 * Zooms by `factor` around the given screen point, adjusting pan so the
 * world point currently under that point stays under it after zooming —
 * the standard "zoom toward the cursor" behavior.
 */
export function zoomAt(viewport, canvasWidth, canvasHeight, sx, sy, factor) {
  const targetZoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const before = screenToWorld(viewport, canvasWidth, canvasHeight, sx, sy);
  const zoomed = { ...viewport, zoom: targetZoom };
  const after = screenToWorld(zoomed, canvasWidth, canvasHeight, sx, sy);

  return {
    ...zoomed,
    panX: zoomed.panX + (before.x - after.x),
    panY: zoomed.panY + (before.y - after.y),
  };
}

export function resetViewport() {
  return createViewport();
}

const FRAME_PADDING = 0.15;
const MIN_FRAME_EXTENT = 20;

/**
 * Pans and zooms to fit every body on screen at once, for jumping back to a
 * useful view after panning away or losing track of a fast body — the same
 * problem "keep centered" solves for one body, generalized to all of them.
 * Bodies with no room to spread out (one body, or a tight cluster) fall back
 * to MIN_FRAME_EXTENT rather than zooming in on empty space around a point.
 */
export function frameBodies(bodies, canvasWidth, canvasHeight) {
  if (bodies.length === 0) return resetViewport();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const body of bodies) {
    minX = Math.min(minX, body.x - body.radius);
    maxX = Math.max(maxX, body.x + body.radius);
    minY = Math.min(minY, body.y - body.radius);
    maxY = Math.max(maxY, body.y + body.radius);
  }

  const width = Math.max(maxX - minX, MIN_FRAME_EXTENT) * (1 + FRAME_PADDING);
  const height = Math.max(maxY - minY, MIN_FRAME_EXTENT) * (1 + FRAME_PADDING);

  return {
    panX: (minX + maxX) / 2,
    panY: (minY + maxY) / 2,
    zoom: clamp(Math.min(canvasWidth / width, canvasHeight / height), MIN_ZOOM, MAX_ZOOM),
  };
}

/**
 * Distance and midpoint between two touch points, in screen pixels. Pulled
 * out as pure functions so pinch-to-zoom's math (comparing the distance
 * across successive touchmove events, zooming around the midpoint) can be
 * tested without simulating actual TouchEvents.
 */
export function touchDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function touchMidpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
