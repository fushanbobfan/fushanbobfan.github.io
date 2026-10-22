// Pan and zoom: a view is { cx, cy, scale } where (cx, cy) is the lattice
// point at the canvas centre and scale is pixels per lattice edge.

export const SCALE_RANGE = [28, 220];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createView(cx = 0.75, cy = -0.4, scale = 84) {
  return { cx, cy, scale };
}

export function worldToScreen(view, w, h, x, y) {
  return { x: w / 2 + (x - view.cx) * view.scale, y: h / 2 + (y - view.cy) * view.scale };
}

export function screenToWorld(view, w, h, sx, sy) {
  return { x: view.cx + (sx - w / 2) / view.scale, y: view.cy + (sy - h / 2) / view.scale };
}

export function visibleBox(view, w, h, pad = 0) {
  const hw = w / 2 / view.scale + pad;
  const hh = h / 2 / view.scale + pad;
  return { x0: view.cx - hw, x1: view.cx + hw, y0: view.cy - hh, y1: view.cy + hh };
}

export function pan(view, dxPixels, dyPixels) {
  return { ...view, cx: view.cx - dxPixels / view.scale, cy: view.cy - dyPixels / view.scale };
}

// Zooms by `factor` keeping the lattice point under (sx, sy) fixed.
export function zoomAt(view, w, h, sx, sy, factor) {
  const before = screenToWorld(view, w, h, sx, sy);
  const scale = clamp(view.scale * factor, ...SCALE_RANGE);
  const next = { ...view, scale };
  const after = screenToWorld(next, w, h, sx, sy);
  return { ...next, cx: next.cx + before.x - after.x, cy: next.cy + before.y - after.y };
}

// Centres a world box and picks the largest scale that fits it, within range.
export function fitBox(box, w, h) {
  const bw = Math.max(1e-6, box.x1 - box.x0);
  const bh = Math.max(1e-6, box.y1 - box.y0);
  const scale = clamp(Math.min(w / bw, h / bh), ...SCALE_RANGE);
  return { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, scale };
}

// Moves the view the least amount that brings a world point inside the
// central part of the canvas (margin is a fraction of each half-size).
export function keepInView(view, w, h, x, y, margin = 0.7) {
  const hw = (w / 2 / view.scale) * margin;
  const hh = (h / 2 / view.scale) * margin;
  let { cx, cy } = view;
  if (x < cx - hw) cx = x + hw;
  if (x > cx + hw) cx = x - hw;
  if (y < cy - hh) cy = y + hh;
  if (y > cy + hh) cy = y - hh;
  return { ...view, cx, cy };
}
