// The Lotka-Volterra predator-prey equations.
//
//   prey      dx/dt = r x - a x y
//   predators dy/dt = e a x y - m y
//
// r: prey birth rate, a: attack rate, e: share of eaten prey turned into new
// predators, m: predator death rate. Populations are in arbitrary units.

export const DEFAULT_PARAMS = Object.freeze({ r: 1, a: 0.05, e: 0.4, m: 0.5 });

export function rates(p, x, y) {
  const eaten = p.a * x * y;
  return [p.r * x - eaten, p.e * eaten - p.m * y];
}

// One classical Runge-Kutta step. Populations never go below zero.
export function rk4Step(p, x, y, dt) {
  const [k1x, k1y] = rates(p, x, y);
  const [k2x, k2y] = rates(p, x + 0.5 * dt * k1x, y + 0.5 * dt * k1y);
  const [k3x, k3y] = rates(p, x + 0.5 * dt * k2x, y + 0.5 * dt * k2y);
  const [k4x, k4y] = rates(p, x + dt * k3x, y + dt * k3y);
  return [
    Math.max(0, x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x)),
    Math.max(0, y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y)),
  ];
}

export function simulate(p, x0, y0, duration, dt = 0.01) {
  const steps = Math.round(duration / dt);
  const t = new Float64Array(steps + 1);
  const x = new Float64Array(steps + 1);
  const y = new Float64Array(steps + 1);
  x[0] = x0;
  y[0] = y0;
  for (let i = 1; i <= steps; i++) {
    t[i] = i * dt;
    [x[i], y[i]] = rk4Step(p, x[i - 1], y[i - 1], dt);
  }
  return { t, x, y };
}

// The coexistence point, where both rates vanish.
export function equilibrium(p) {
  return { x: p.m / (p.e * p.a), y: p.r / p.a };
}

// V is constant along every orbit and smallest at the equilibrium, so each
// orbit is a closed level curve of V around it.
export function invariant(p, x, y) {
  return p.e * p.a * x - p.m * Math.log(x) + p.a * y - p.r * Math.log(y);
}

// Small swings around the equilibrium are ellipses with this period.
export function smallSwingPeriod(p) {
  return (2 * Math.PI) / Math.sqrt(p.r * p.m);
}

// Period and time averages from the last two prey peaks of a sampled orbit.
// Returns null until the series holds two peaks.
export function measureCycle(t, x, y, n = x.length) {
  const peaks = [];
  for (let i = n - 2; i >= 1 && peaks.length < 2; i--) {
    if (x[i] > x[i - 1] && x[i] >= x[i + 1]) peaks.push(i);
  }
  if (peaks.length < 2) return null;
  const [i2, i1] = peaks;
  const peakTime = (i) => {
    const curve = x[i - 1] - 2 * x[i] + x[i + 1];
    const shift = curve === 0 ? 0 : (0.5 * (x[i - 1] - x[i + 1])) / curve;
    return t[i] + shift * (t[i + 1] - t[i]);
  };
  let sx = 0;
  let sy = 0;
  let maxX = -Infinity;
  let minX = Infinity;
  let maxY = -Infinity;
  let minY = Infinity;
  for (let i = i1; i < i2; i++) {
    const h = t[i + 1] - t[i];
    sx += 0.5 * h * (x[i] + x[i + 1]);
    sy += 0.5 * h * (y[i] + y[i + 1]);
    maxX = Math.max(maxX, x[i]);
    minX = Math.min(minX, x[i]);
    maxY = Math.max(maxY, y[i]);
    minY = Math.min(minY, y[i]);
  }
  const span = t[i2] - t[i1];
  return {
    period: peakTime(i2) - peakTime(i1),
    meanX: sx / span,
    meanY: sy / span,
    minX,
    maxX,
    minY,
    maxY,
  };
}

// Largest populations an orbit reaches within a time span, for sizing axes.
export function orbitExtent(p, x0, y0, duration, dt = 0.02) {
  let x = x0;
  let y = y0;
  let maxX = x;
  let maxY = y;
  for (let i = Math.round(duration / dt); i > 0; i--) {
    [x, y] = rk4Step(p, x, y, dt);
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { maxX, maxY };
}

// Smallest of 1, 2, 2.5 and 5 times a power of ten that is at least v.
export function niceCeil(v) {
  if (!(v > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= v * (1 - 1e-12)) return step * power;
  }
  return 10 * power;
}
