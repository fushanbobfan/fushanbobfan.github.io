// Iteration of the quadratic family f_c(z) = z^2 + c.
//
// Everything here works on plain numbers so the render loop can call it for
// every pixel without allocating. Results are written into a caller-owned
// Float64Array of length SAMPLE_SIZE.

export const BAILOUT = 1000;
const BAILOUT2 = BAILOUT * BAILOUT;
const LN2 = Math.LN2;

// Indices into a sample record.
export const ESCAPED = 0; // 1 if the orbit left the bailout disk, else 0
export const SMOOTH = 1; // continuous escape count (escaped points only)
export const DISTANCE = 2; // distance estimate to the set (escaped points only)
export const PERIOD = 3; // period of the cycle the orbit settled on, 0 if unknown
export const SAMPLE_SIZE = 4;

// Points in the main cardioid or the period-2 disk never escape, and they are
// a large part of the default view, so they are answered without iterating.
export function inMainCardioid(x, y) {
  const a = x - 0.25;
  const q = a * a + y * y;
  return q * (q + a) <= 0.25 * y * y;
}

export function inPeriod2Bulb(x, y) {
  const a = x + 1;
  return a * a + y * y <= 0.0625;
}

// Iterates z -> z^2 + c from z0 = (zx, zy) and fills `out`.
//
// With `julia` false the derivative is taken with respect to c (the Mandelbrot
// picture, z0 = 0); with `julia` true it is taken with respect to z0 (the
// Julia picture). The distance estimate is G / (2 |G'|) for the Green's
// function G, which the Koebe quarter theorem places within a factor of four
// of the true distance once the bailout radius is large.
//
// Bounded orbits are checked for periodicity Brent-style: the orbit is
// compared against a point saved at power-of-two steps, so an orbit that has
// settled on a cycle stops early and reports the cycle's length.
export function sample(out, zx, zy, cx, cy, maxIter, julia) {
  out[ESCAPED] = 0;
  out[SMOOTH] = 0;
  out[DISTANCE] = 0;
  out[PERIOD] = 0;

  let x = zx;
  let y = zy;
  let dx = julia ? 1 : 0;
  let dy = 0;
  let sx = x;
  let sy = y;
  let saveAt = 8;
  let sinceSave = 0;
  const eps = 1e-13;

  for (let n = 0; n < maxIter; n++) {
    // derivative first, it needs the old z
    const ndx = 2 * (x * dx - y * dy) + (julia ? 0 : 1);
    const ndy = 2 * (x * dy + y * dx);
    dx = ndx;
    dy = ndy;
    const nx = x * x - y * y + cx;
    y = 2 * x * y + cy;
    x = nx;

    const r2 = x * x + y * y;
    if (r2 > BAILOUT2) {
      const lnr = 0.5 * Math.log(r2);
      out[ESCAPED] = 1;
      out[SMOOTH] = n + 2 - Math.log(lnr) / LN2;
      const dmag = Math.sqrt(dx * dx + dy * dy);
      out[DISTANCE] = dmag > 0 ? (0.5 * Math.sqrt(r2) * lnr) / dmag : 0;
      return out;
    }

    sinceSave++;
    const ex = x - sx;
    const ey = y - sy;
    if (ex * ex + ey * ey < eps * eps) {
      out[PERIOD] = sinceSave;
      return out;
    }
    if (sinceSave === saveAt) {
      sx = x;
      sy = y;
      sinceSave = 0;
      saveAt *= 2;
    }
  }
  return out;
}

// The orbit of z0 under f_c as a flat [x0, y0, x1, y1, ...] array. It stops
// after the first point outside `radius` (included), or after `count` points.
export function orbit(zx, zy, cx, cy, count, radius = 2) {
  const pts = [zx, zy];
  let x = zx;
  let y = zy;
  const r2max = radius * radius;
  for (let n = 1; n < count; n++) {
    const nx = x * x - y * y + cx;
    y = 2 * x * y + cy;
    x = nx;
    pts.push(x, y);
    if (x * x + y * y > r2max) break;
  }
  return Float64Array.from(pts);
}
