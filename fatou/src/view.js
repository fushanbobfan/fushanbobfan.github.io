// A view maps canvas pixels to the complex plane: (cx, cy) sits at the
// centre of the canvas and every pixel is `scale` units wide. The imaginary
// axis points up, so pixel rows run against it.

export function makeView(cx, cy, scale) {
  return { cx, cy, scale };
}

// A view that shows the rectangle [xmin, xmax] x [ymin, ymax] whole.
export function fitView(xmin, xmax, ymin, ymax, width, height) {
  const scale = Math.max((xmax - xmin) / width, (ymax - ymin) / height);
  return makeView((xmin + xmax) / 2, (ymin + ymax) / 2, scale);
}

export function toComplex(view, width, height, px, py) {
  return [view.cx + (px - width / 2) * view.scale, view.cy - (py - height / 2) * view.scale];
}

export function toPixel(view, width, height, x, y) {
  return [(x - view.cx) / view.scale + width / 2, (view.cy - y) / view.scale + height / 2];
}

// Zooms by `factor` (> 1 zooms in) keeping the point under (px, py) fixed.
export function zoomAt(view, width, height, px, py, factor) {
  const [x, y] = toComplex(view, width, height, px, py);
  const scale = view.scale / factor;
  return makeView(x - (px - width / 2) * scale, y + (py - height / 2) * scale, scale);
}

export function panBy(view, dxPixels, dyPixels) {
  return makeView(view.cx - dxPixels * view.scale, view.cy + dyPixels * view.scale, view.scale);
}

// Doubles carry 52 bits of mantissa. Once a pixel is narrower than a few
// hundred ulps of the coordinates, neighbouring pixels start to share values
// and the picture turns blocky.
export function precisionLimited(view) {
  const mag = Math.max(Math.abs(view.cx), Math.abs(view.cy), 1);
  return view.scale < mag * Number.EPSILON * 256;
}

// Iteration budget that grows with depth, the usual rule of thumb: detail at
// magnification m needs roughly sqrt(m)-proportional extra iterations.
export function suggestedIterations(view, width) {
  const magnification = 3 / (view.scale * width);
  return Math.round(Math.min(20000, Math.max(200, 200 * Math.pow(Math.max(1, magnification), 0.25))));
}
