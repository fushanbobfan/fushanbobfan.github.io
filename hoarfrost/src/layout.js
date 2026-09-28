// Screen layout of the hexagonal patch. Cells are flat-topped hexagons, so
// the six neighbour directions point at 30, 90, 150 ... degrees and a crystal
// grows with one arm straight up, as snowflakes are usually drawn.

const SQRT3 = Math.sqrt(3);

// Centre of cell (q, r) relative to the patch centre, for hexagons of
// circumradius `size`.
export function axialToPixel(q, r, size) {
  return { x: size * 1.5 * q, y: size * SQRT3 * (r + q / 2) };
}

// Round fractional cube coordinates to the nearest cell.
function cubeRound(fq, fr) {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q + 0, r + 0];
}

// The cell containing a point given relative to the patch centre.
export function pixelToAxial(x, y, size) {
  const fq = ((2 / 3) * x) / size;
  const fr = ((-1 / 3) * x + (SQRT3 / 3) * y) / size;
  return cubeRound(fq, fr);
}

// Largest hexagon size at which a patch of the given radius fits the box.
export function fitSize(width, height, radius) {
  const across = 1.5 * (2 * radius) + 2; // flat-top: width in units of size
  const tall = SQRT3 * (2 * radius + 1);
  return Math.min(width / across, height / tall);
}

// For every pixel of a width x height image, the index of the cell under the
// pixel's centre, or -1 outside the patch.
export function buildPixelMap(grid, width, height) {
  const size = fitSize(width, height, grid.radius);
  const map = new Int32Array(width * height);
  const cx = width / 2;
  const cy = height / 2;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const [q, r] = pixelToAxial(px + 0.5 - cx, py + 0.5 - cy, size);
      map[py * width + px] = grid.index(q, r);
    }
  }
  return { map, size, width, height };
}
