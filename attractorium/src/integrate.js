// Fourth-order Runge-Kutta for the flows in systems.js, plus the measurements
// built on it: a long sampled orbit, the largest Lyapunov exponent and the
// successive maxima of one coordinate.

export function createStepper(field, params) {
  const k1 = new Float64Array(3);
  const k2 = new Float64Array(3);
  const k3 = new Float64Array(3);
  const k4 = new Float64Array(3);
  const tmp = new Float64Array(3);
  // Advances state (any array of length 3) in place by one step of size dt.
  return function step(state, dt) {
    field(params, state, k1);
    for (let i = 0; i < 3; i++) tmp[i] = state[i] + 0.5 * dt * k1[i];
    field(params, tmp, k2);
    for (let i = 0; i < 3; i++) tmp[i] = state[i] + 0.5 * dt * k2[i];
    field(params, tmp, k3);
    for (let i = 0; i < 3; i++) tmp[i] = state[i] + dt * k3[i];
    field(params, tmp, k4);
    for (let i = 0; i < 3; i++) state[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return state;
  };
}

export function isFiniteState(s) {
  return Number.isFinite(s[0]) && Number.isFinite(s[1]) && Number.isFinite(s[2]);
}

// Runs `transient` steps to forget the start, then records `count` points,
// one every `every` steps, as a flat Float32Array [x0, y0, z0, x1, ...].
// Stops early if the orbit escapes to infinity; `length` says how many points
// were kept and `state` is where the orbit ended.
export function sampleOrbit(system, params, { start = system.start, dt = system.dt, transient = 2000, count = 20000, every = 1 } = {}) {
  const step = createStepper(system.field, params);
  const s = Float64Array.from(start);
  for (let i = 0; i < transient; i++) {
    step(s, dt);
    if (!isFiniteState(s)) return { points: new Float32Array(0), length: 0, state: s, escaped: true };
  }
  const points = new Float32Array(count * 3);
  let n = 0;
  for (; n < count; n++) {
    for (let k = 0; k < every; k++) step(s, dt);
    if (!isFiniteState(s) || Math.abs(s[0]) + Math.abs(s[1]) + Math.abs(s[2]) > 1e6) {
      return { points: points.subarray(0, n * 3), length: n, state: s, escaped: true };
    }
    points[3 * n] = s[0];
    points[3 * n + 1] = s[1];
    points[3 * n + 2] = s[2];
  }
  return { points, length: n, state: s, escaped: false };
}

export function bounds(points, length = points.length / 3) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < length; i++) {
    for (let a = 0; a < 3; a++) {
      const v = points[3 * i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max, center: min.map((m, a) => (m + max[a]) / 2) };
}

// Benettin's two-orbit estimate of the largest Lyapunov exponent. A shadow
// orbit starts d0 away; after each interval of `renorm` steps the separation
// is measured, its log growth added up, and the shadow pulled back to d0
// along the same direction. Returns an incremental estimator so the page can
// refine the number while it animates.
export function createLyapunov(system, params, { start, dt = system.dt, d0 = 1e-8, renorm = 10 } = {}) {
  const step = createStepper(system.field, params);
  const a = Float64Array.from(start ?? system.start);
  const b = Float64Array.from([a[0] + d0, a[1], a[2]]);
  let sumLog = 0;
  let time = 0;
  return {
    advance(intervals) {
      for (let n = 0; n < intervals; n++) {
        for (let k = 0; k < renorm; k++) {
          step(a, dt);
          step(b, dt);
        }
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const d = Math.hypot(dx, dy, dz);
        if (!(d > 0) || !isFiniteState(a)) return this;
        sumLog += Math.log(d / d0);
        time += renorm * dt;
        const f = d0 / d;
        b[0] = a[0] + dx * f;
        b[1] = a[1] + dy * f;
        b[2] = a[2] + dz * f;
      }
      return this;
    },
    get value() {
      return time > 0 ? sumLog / time : NaN;
    },
    get time() {
      return time;
    },
    get state() {
      return a;
    },
  };
}

export function largestLyapunov(system, params, { time = 200, transient = 20, dt = system.dt, renorm = 10 } = {}) {
  const warm = sampleOrbit(system, params, { dt, transient: Math.round(transient / dt), count: 1 });
  const est = createLyapunov(system, params, { start: warm.state, dt, renorm });
  est.advance(Math.round(time / (dt * renorm)));
  return est.value;
}

// Local maxima of coordinate `axis` along a sampled orbit, each refined by a
// parabola through the sample and its two neighbours. Lorenz plotted
// consecutive maxima of z against each other in 1963 and found a single-humped
// curve: the next lobe height is (almost) a function of the last one.
export function successiveMaxima(points, length, axis) {
  const out = [];
  for (let i = 1; i < length - 1; i++) {
    const y0 = points[3 * (i - 1) + axis];
    const y1 = points[3 * i + axis];
    const y2 = points[3 * (i + 1) + axis];
    if (y1 > y0 && y1 >= y2) {
      const denom = y0 - 2 * y1 + y2;
      out.push(denom < 0 ? y1 - ((y2 - y0) * (y2 - y0)) / (8 * denom) : y1);
    }
  }
  return out;
}

// Groups values that agree to within `tol` and returns the cluster centres in
// ascending order: the number of distinct maxima of a periodic orbit.
export function distinctLevels(values, tol) {
  const sorted = [...values].sort((x, y) => x - y);
  const levels = [];
  let sum = 0;
  let n = 0;
  let last = -Infinity;
  for (const v of sorted) {
    if (n > 0 && v - last > tol) {
      levels.push(sum / n);
      sum = 0;
      n = 0;
    }
    sum += v;
    n++;
    last = v;
  }
  if (n > 0) levels.push(sum / n);
  return levels;
}
