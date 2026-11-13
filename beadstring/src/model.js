// A string of n equal beads between two fixed walls, small sideways motion.
//
// Each bead feels the string pulling it toward its neighbours and, optionally,
// its own spring pulling it back to the axis (a row of pendulums joined by
// weak springs is the same system):
//
//   y_j'' = coupling² (y_{j-1} - 2 y_j + y_{j+1}) - anchor² y_j - damping y_j'
//
// with y_0 = y_{n+1} = 0. Units: bead mass 1, spacing 1. `coupling` is
// sqrt(tension / (mass · spacing)); `anchor` is the frequency a lone bead
// would have on its own spring.
//
// The normal modes are sine shapes, so the motion is solved exactly mode by
// mode instead of being integrated: no step size and no drift.

export const DEFAULT_PARAMS = Object.freeze({ coupling: 1, anchor: 0, damping: 0 });

// Orthonormal shape of mode k (1..n): value at beads 1..n.
export function modeShape(n, k) {
  const scale = Math.sqrt(2 / (n + 1));
  const out = new Float64Array(n);
  for (let j = 1; j <= n; j++) out[j - 1] = scale * Math.sin((j * k * Math.PI) / (n + 1));
  return out;
}

// Undamped angular frequency of mode k. With no anchor, the highest mode
// approaches 2·coupling: neighbours swing against each other.
export function modeFrequency(n, k, params = DEFAULT_PARAMS) {
  const s = Math.sin((k * Math.PI) / (2 * (n + 1)));
  return Math.sqrt(params.anchor ** 2 + 4 * params.coupling ** 2 * s * s);
}

// The same mode on a continuous string of the same length and mass: the
// frequency grows in proportion to k, so overtones are whole multiples.
export function continuumFrequency(n, k, params = DEFAULT_PARAMS) {
  const w = (params.coupling * k * Math.PI) / (n + 1);
  return Math.sqrt(params.anchor ** 2 + w * w);
}

export function frequencies(n, params = DEFAULT_PARAMS) {
  const out = new Float64Array(n);
  for (let k = 1; k <= n; k++) out[k - 1] = modeFrequency(n, k, params);
  return out;
}

// Mode amplitudes of a shape given at beads 1..n (the shapes are orthonormal,
// so this is a plain dot product).
export function project(values) {
  const n = values.length;
  const out = new Float64Array(n);
  for (let k = 1; k <= n; k++) {
    const phi = modeShape(n, k);
    let sum = 0;
    for (let j = 0; j < n; j++) sum += phi[j] * values[j];
    out[k - 1] = sum;
  }
  return out;
}

// Bead values from mode amplitudes.
export function synthesize(coeffs) {
  const n = coeffs.length;
  const out = new Float64Array(n);
  for (let k = 1; k <= n; k++) {
    const c = coeffs[k - 1];
    if (c === 0) continue;
    const phi = modeShape(n, k);
    for (let j = 0; j < n; j++) out[j] += c * phi[j];
  }
  return out;
}

// Advance one damped oscillator q'' = -w² q - g q' by dt, exactly.
export function evolveMode(q, p, w, g, dt) {
  const c = g / 2;
  const s = w * w - c * c;
  const decay = Math.exp(-c * dt);
  const lead = p + c * q;
  if (Math.abs(s) < 1e-12) {
    return [decay * (q + lead * dt), decay * (p - c * lead * dt)];
  }
  if (s > 0) {
    const wd = Math.sqrt(s);
    const cs = Math.cos(wd * dt);
    const sn = Math.sin(wd * dt);
    return [decay * (q * cs + (lead / wd) * sn), decay * (p * cs - (wd * q + (c * lead) / wd) * sn)];
  }
  const r = Math.sqrt(-s);
  const ch = Math.cosh(r * dt);
  const sh = Math.sinh(r * dt);
  return [decay * (q * ch + (lead / r) * sh), decay * (p * ch + (r * q - (c * lead) / r) * sh)];
}

// Initial shapes, each given at beads 1..n with amplitude `amp`.
export function pluckShape(n, bead, amp) {
  const out = new Float64Array(n);
  for (let j = 1; j <= n; j++) {
    out[j - 1] = j <= bead ? (amp * j) / bead : (amp * (n + 1 - j)) / (n + 1 - bead);
  }
  return out;
}

export function nudgeShape(n, bead, amp) {
  const out = new Float64Array(n);
  out[bead - 1] = amp;
  return out;
}

export function bumpShape(n, center, width, amp) {
  const out = new Float64Array(n);
  for (let j = 1; j <= n; j++) {
    const d = Math.abs(j - center);
    out[j - 1] = d < width ? amp * (1 - d / width) : 0;
  }
  return out;
}

export function modeOnly(n, k, amp) {
  const coeffs = new Float64Array(n);
  coeffs[k - 1] = amp / Math.sqrt(2 / (n + 1));
  return synthesize(coeffs);
}

// The moving string: mode displacements q and velocities p.
export function createString(n, params = DEFAULT_PARAMS, shape = new Float64Array(n), velocity = null) {
  return {
    n,
    params: { ...params },
    omega: frequencies(n, params),
    q: project(shape),
    p: velocity ? project(velocity) : new Float64Array(n),
    t: 0,
  };
}

export function step(string, dt) {
  const { n, omega, q, p } = string;
  const g = string.params.damping;
  for (let k = 0; k < n; k++) {
    [q[k], p[k]] = evolveMode(q[k], p[k], omega[k], g, dt);
  }
  string.t += dt;
  return string;
}

// Change the physics without changing the present shape or motion.
export function setParams(string, params) {
  string.params = { ...string.params, ...params };
  string.omega = frequencies(string.n, string.params);
  return string;
}

export function positions(string) {
  return synthesize(string.q);
}

export function velocities(string) {
  return synthesize(string.p);
}

// Energy of each mode: (p² + w² q²) / 2.
export function modeEnergies(string) {
  const out = new Float64Array(string.n);
  for (let k = 0; k < string.n; k++) {
    out[k] = 0.5 * (string.p[k] ** 2 + string.omega[k] ** 2 * string.q[k] ** 2);
  }
  return out;
}

export function totalEnergy(string) {
  return modeEnergies(string).reduce((a, b) => a + b, 0);
}

// Energy computed bead by bead: motion, own spring, and the string segments.
// A segment between two beads is split evenly; a segment to a wall belongs to
// its bead. The parts sum to the total energy.
export function beadEnergies(y, v, params) {
  const n = y.length;
  const k2 = params.coupling ** 2;
  const a2 = params.anchor ** 2;
  const out = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    out[j] = 0.5 * v[j] ** 2 + 0.5 * a2 * y[j] ** 2;
    const left = j === 0 ? y[0] ** 2 : 0.5 * (y[j] - y[j - 1]) ** 2;
    const right = j === n - 1 ? y[j] ** 2 : 0.5 * (y[j + 1] - y[j]) ** 2;
    out[j] += 0.5 * k2 * (left + right);
  }
  return out;
}

// For two beads: how long energy takes to pass from one bead to the other and
// back (the beat period). Infinity when the two frequencies coincide.
export function beatPeriod(params) {
  const w1 = modeFrequency(2, 1, params);
  const w2 = modeFrequency(2, 2, params);
  return w2 > w1 ? (2 * Math.PI) / (w2 - w1) : Infinity;
}

// Overtone ratios w_k / w_1 for k = 2..count+1 (a continuous string with no
// anchor gives 2, 3, 4, ...).
export function overtoneRatios(n, params, count = 3) {
  const w1 = modeFrequency(n, 1, params);
  const out = [];
  for (let k = 2; k <= Math.min(n, count + 1); k++) out.push(modeFrequency(n, k, params) / w1);
  return out;
}
