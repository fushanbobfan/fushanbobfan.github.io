// Pure math for rendering a small overview of the whole system regardless of how the main
// viewport is currently panned or zoomed, kept DOM-free like viewport.js so the fit-to-bounds
// and coordinate-mapping logic can be tested without a canvas.

/**
 * The smallest axis-aligned box containing every body (including its radius), or `null` if
 * there are no bodies to bound.
 */
export function computeBounds(bodies) {
  if (bodies.length === 0) return null;

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

  return { minX, maxX, minY, maxY };
}

const MINIMAP_PADDING = 0.2;
const MIN_MINIMAP_EXTENT = 20;

/**
 * A transform that fits every body's bounding box inside a `width` x `height` minimap, with
 * padding so nothing sits flush against its edge. Unlike `frameBodies` (which pans/zooms the
 * main viewport itself), this only describes how to draw a small overview alongside it.
 */
export function computeMinimapTransform(bodies, width, height) {
  const bounds = computeBounds(bodies);
  if (!bounds) return { scale: 1, centerX: 0, centerY: 0, width, height };

  const spanX = Math.max(bounds.maxX - bounds.minX, MIN_MINIMAP_EXTENT) * (1 + MINIMAP_PADDING);
  const spanY = Math.max(bounds.maxY - bounds.minY, MIN_MINIMAP_EXTENT) * (1 + MINIMAP_PADDING);

  return {
    scale: Math.min(width / spanX, height / spanY),
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerY: (bounds.minY + bounds.maxY) / 2,
    width,
    height,
  };
}

export function worldToMinimapPoint(transform, x, y) {
  return {
    x: transform.width / 2 + (x - transform.centerX) * transform.scale,
    y: transform.height / 2 + (y - transform.centerY) * transform.scale,
  };
}

/**
 * The rectangle (in minimap pixel space) outlining what the main viewport currently shows, so
 * the minimap can draw a "you are here" box over the full system. Derived straight from
 * `viewport`'s pan/zoom and the main canvas size — no dependency on `viewport.js` itself, so
 * this module doesn't need to know how the main viewport's transform is implemented.
 */
export function viewportRectOnMinimap(transform, viewport, mainCanvasWidth, mainCanvasHeight) {
  const halfWorldWidth = mainCanvasWidth / 2 / viewport.zoom;
  const halfWorldHeight = mainCanvasHeight / 2 / viewport.zoom;

  const topLeft = worldToMinimapPoint(transform, viewport.panX - halfWorldWidth, viewport.panY - halfWorldHeight);
  const bottomRight = worldToMinimapPoint(transform, viewport.panX + halfWorldWidth, viewport.panY + halfWorldHeight);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}
