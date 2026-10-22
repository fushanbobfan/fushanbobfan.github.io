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

// Outline of a NACA four-digit section ("2412": 2% camber at 40% chord, 12%
// thick) with chord D, leading edge at u = -D/2 and the suction side at
// negative v, which is up on screen. Points run round the section once:
// along the upper surface from the trailing edge, then back along the lower.
export function nacaOutline(code, D, points = 60) {
  const m = Number(code[0]) / 100;
  const p = Number(code[1]) / 10;
  const t = Number(code.slice(2, 4)) / 100;
  const upper = [], lower = [];
  for (let k = 0; k <= points; k++) {
    const x = (1 - Math.cos((Math.PI * k) / points)) / 2;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    let yc = 0, dyc = 0;
    if (m > 0 && p > 0) {
      if (x < p) {
        yc = (m / (p * p)) * (2 * p * x - x * x);
        dyc = ((2 * m) / (p * p)) * (p - x);
      } else {
        yc = (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
        dyc = ((2 * m) / (1 - p) ** 2) * (p - x);
      }
    }
    const th = Math.atan(dyc);
    upper.push([(x - yt * Math.sin(th) - 0.5) * D, -(yc + yt * Math.cos(th)) * D]);
    lower.push([(x + yt * Math.sin(th) - 0.5) * D, -(yc - yt * Math.cos(th)) * D]);
  }
  return upper.reverse().concat(lower.slice(1));
}

const outlines = new Map();
function outlineFor(code, D) {
  const key = `${code}:${D}`;
  if (!outlines.has(key)) {
    if (outlines.size > 32) outlines.clear();
    outlines.set(key, nacaOutline(code, D));
  }
  return outlines.get(key);
}

export function insidePolygon(poly, u, v) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i], [uj, vj] = poly[j];
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
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
    case 'airfoil': {
      const [u, v] = toLocal(shape, px, py);
      if (Math.abs(u) > D / 2 || Math.abs(v) > D / 2) return false;
      return insidePolygon(outlineFor(shape.naca || '0012', D), u, v);
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
