// Obstacles in lattice units. Each shape has a centre (x, y), a size D that
// also serves as the length in the Reynolds number, and an angle in degrees.
// The stream comes from the left, so a positive angle raises the left end:
// nose up for a plate or wing, a clockwise turn as drawn.

export const SHAPES = ['cylinder', 'square', 'plate', 'airfoil', 'none'];

// Map a point into the shape's own frame: origin at the centre, x along the
// shape. With rows running downwards the shape's axis points along
// (cos a, sin a), which drops the right end and lifts the left.
function toLocal(shape, px, py) {
  const a = (shape.angle || 0) * (Math.PI / 180);
  const dx = px - shape.x, dy = py - shape.y;
  const c = Math.cos(a), s = Math.sin(a);
  return [c * dx + s * dy, -s * dx + c * dy];
}

export function plateThickness(D) {
  return Math.max(2, D / 8);
}

export function contains(shape, px, py) {
  const D = shape.size;
  switch (shape.kind) {
    case 'cylinder':
      return (px - shape.x) ** 2 + (py - shape.y) ** 2 <= (D / 2) ** 2;
    case 'square': {
      const [u, v] = toLocal(shape, px, py);
      return Math.abs(u) <= D / 2 && Math.abs(v) <= D / 2;
    }
    case 'plate': {
      const [u, v] = toLocal(shape, px, py);
      return Math.abs(u) <= D / 2 && Math.abs(v) <= plateThickness(D) / 2;
    }
    default:
      return false;
  }
}

// Solid mask for an nx by ny lattice, testing each cell centre.
export function rasterize(shape, nx, ny, out = new Uint8Array(nx * ny)) {
  out.fill(0);
  if (!shape || shape.kind === 'none') return out;
  const r = shape.size;
  const x0 = Math.max(0, Math.floor(shape.x - r)), x1 = Math.min(nx - 1, Math.ceil(shape.x + r));
  const y0 = Math.max(0, Math.floor(shape.y - r)), y1 = Math.min(ny - 1, Math.ceil(shape.y + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (contains(shape, x, y)) out[y * nx + x] = 1;
    }
  }
  return out;
}

// Height of the shape across the stream: the extent of its solid cells in y.
export function frontalHeight(mask, nx, ny) {
  let lo = ny, hi = -1;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      if (mask[y * nx + x]) {
        if (y < lo) lo = y;
        if (y > hi) hi = y;
        break;
      }
    }
  }
  return hi < lo ? 0 : hi - lo + 1;
}
