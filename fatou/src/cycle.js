// Attracting cycles of f_c(z) = z^2 + c and the centres of hyperbolic
// components.
//
// When c lies in a hyperbolic component of the Mandelbrot set, the critical
// orbit (the orbit of 0) is drawn into an attracting cycle. Its length is the
// component's period and its multiplier lambda = prod 2 z_i, |lambda| < 1, is
// the component's internal coordinate: lambda = 0 at the centre (nucleus) and
// |lambda| = 1 on the component's boundary.

function cmul(ax, ay, bx, by) {
  return [ax * bx - ay * by, ax * by + ay * bx];
}

// Follows the critical orbit for up to maxIter steps and returns the cycle it
// settles on, or null when the orbit escapes or has not settled.
export function attractingCycle(cx, cy, maxIter = 20000, maxPeriod = 1024) {
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let saveAt = 8;
  let since = 0;
  let period = 0;
  let steps = 0;
  const eps = 1e-12;
  for (; steps < maxIter; steps++) {
    const nx = x * x - y * y + cx;
    y = 2 * x * y + cy;
    x = nx;
    if (x * x + y * y > 4) return null;
    since++;
    const ex = x - sx;
    const ey = y - sy;
    if (ex * ex + ey * ey < eps * eps) {
      period = since;
      break;
    }
    if (since === saveAt) {
      sx = x;
      sy = y;
      since = 0;
      saveAt *= 2;
    }
  }
  if (!period || period > maxPeriod) return null;

  // Newton on g(z) = f^p(z) - z sharpens the cycle point to full precision.
  for (let k = 0; k < 4; k++) {
    let zx = x;
    let zy = y;
    let dx = 1;
    let dy = 0;
    for (let i = 0; i < period; i++) {
      [dx, dy] = cmul(2 * zx, 2 * zy, dx, dy);
      const nx = zx * zx - zy * zy + cx;
      zy = 2 * zx * zy + cy;
      zx = nx;
    }
    const gx = zx - x;
    const gy = zy - y;
    const hx = dx - 1;
    const hy = dy;
    const den = hx * hx + hy * hy;
    if (den < 1e-300) break;
    x -= (gx * hx + gy * hy) / den;
    y -= (gy * hx - gx * hy) / den;
  }

  const points = new Float64Array(2 * period);
  let mx = 1;
  let my = 0;
  let zx = x;
  let zy = y;
  for (let i = 0; i < period; i++) {
    points[2 * i] = zx;
    points[2 * i + 1] = zy;
    [mx, my] = cmul(mx, my, 2 * zx, 2 * zy);
    const nx = zx * zx - zy * zy + cx;
    zy = 2 * zx * zy + cy;
    zx = nx;
  }
  // An orbit can also land exactly on a repelling cycle (c = i, c = -2);
  // those parameters sit on the boundary and have no attracting cycle.
  if (Math.hypot(mx, my) >= 1) return null;
  return {
    period,
    points,
    multiplier: { re: mx, im: my, abs: Math.hypot(mx, my), arg: Math.atan2(my, mx) },
    settledAfter: steps + 1,
  };
}

// Newton's method in c for f_c^p(0) = 0: from a guess inside (or near) a
// component of period p it lands on that component's centre. Returns null if
// the iteration does not converge.
export function nucleus(cx, cy, period, maxSteps = 60) {
  let x = cx;
  let y = cy;
  for (let k = 0; k < maxSteps; k++) {
    let zx = 0;
    let zy = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < period; i++) {
      // d/dc (z^2 + c) = 2 z dz + 1
      [dx, dy] = cmul(2 * zx, 2 * zy, dx, dy);
      dx += 1;
      const nx = zx * zx - zy * zy + x;
      zy = 2 * zx * zy + y;
      zx = nx;
    }
    const den = dx * dx + dy * dy;
    if (!(den > 1e-300) || !Number.isFinite(den)) return null;
    const stepx = (zx * dx + zy * dy) / den;
    const stepy = (zy * dx - zx * dy) / den;
    x -= stepx;
    y -= stepy;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (Math.hypot(stepx, stepy) < 1e-15 * Math.max(1, Math.hypot(x, y))) {
      return { re: x, im: y, steps: k + 1 };
    }
  }
  return null;
}
