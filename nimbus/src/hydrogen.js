// Exact bound states of the hydrogen atom in atomic units (lengths in Bohr
// radii, an infinitely heavy nucleus). psi_nlm(r, theta, phi) = R_nl(r) Y_lm,
// with the real spherical harmonics chemists draw (p_x, d_xy, ...).

export const MAX_N = 6;
export const BOHR_ANGSTROM = 0.529177210544; // CODATA 2022
export const RYDBERG_EV = 13.605693122990; // CODATA 2022, infinite nuclear mass

const factorial = (k) => {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
};

export function checkQuantumNumbers(n, l, m) {
  if (!Number.isInteger(n) || !Number.isInteger(l) || !Number.isInteger(m)) {
    throw new RangeError('quantum numbers must be integers');
  }
  if (n < 1 || n > MAX_N) throw new RangeError(`n must be 1..${MAX_N}`);
  if (l < 0 || l >= n) throw new RangeError('l must be 0..n-1');
  if (Math.abs(m) > l) throw new RangeError('m must be -l..l');
}

// Generalised Laguerre polynomial L_k^alpha(x) by its three-term recurrence.
export function laguerre(k, alpha, x) {
  if (k === 0) return 1;
  let prev = 1;
  let cur = 1 + alpha - x;
  for (let j = 1; j < k; j++) {
    const next = ((2 * j + 1 + alpha - x) * cur - (j + alpha) * prev) / (j + 1);
    prev = cur;
    cur = next;
  }
  return cur;
}

export function radialNorm(n, l) {
  return Math.sqrt((2 / n) ** 3 * factorial(n - l - 1) / (2 * n * factorial(n + l)));
}

// R_nl(r), normalised so that the integral of r^2 R^2 dr over [0, inf) is 1.
export function radial(n, l, r, norm = radialNorm(n, l)) {
  const rho = (2 * r) / n;
  return norm * Math.exp(-rho / 2) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho);
}

// Probability per unit radius of finding the electron at distance r.
export function radialDensity(n, l, r) {
  const R = radial(n, l, r);
  return r * r * R * R;
}

// Expectation values that have closed forms.
export const meanRadius = (n, l) => (3 * n * n - l * (l + 1)) / 2;
export const energyEV = (n) => -RYDBERG_EV / (n * n);

// Associated Legendre function P_l^m(x) for m >= 0, without the
// Condon-Shortley phase, so that p_x is positive along +x.
export function legendre(l, m, x) {
  let pmm = 1;
  if (m > 0) {
    const s = Math.sqrt(Math.max(0, (1 - x) * (1 + x)));
    let odd = 1;
    for (let i = 1; i <= m; i++) {
      pmm *= odd * s;
      odd += 2;
    }
  }
  if (l === m) return pmm;
  let pm1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pm1;
  let pl = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pl = ((2 * ll - 1) * x * pm1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pm1;
    pm1 = pl;
  }
  return pl;
}

export function harmonicNorm(l, m) {
  const am = Math.abs(m);
  const base = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * factorial(l - am) / factorial(l + am));
  return m === 0 ? base : Math.SQRT2 * base;
}

// Real spherical harmonic: cos(m phi) for m > 0, sin(|m| phi) for m < 0.
export function realHarmonic(l, m, cosTheta, phi, norm = harmonicNorm(l, m)) {
  const p = legendre(l, Math.abs(m), cosTheta);
  if (m > 0) return norm * p * Math.cos(m * phi);
  if (m < 0) return norm * p * Math.sin(-m * phi);
  return norm * p;
}

// Everything needed to evaluate one orbital quickly at Cartesian points.
export function makeOrbital(n, l, m) {
  checkQuantumNumbers(n, l, m);
  const rn = radialNorm(n, l);
  const yn = harmonicNorm(l, m);
  const psi = (x, y, z) => {
    const r = Math.hypot(x, y, z);
    const c = r > 0 ? z / r : 1;
    const phi = Math.atan2(y, x);
    return radial(n, l, r, rn) * realHarmonic(l, m, c, phi, yn);
  };
  return { n, l, m, psi, radial: (r) => radial(n, l, r, rn), angular: (c, phi) => realHarmonic(l, m, c, phi, yn) };
}

// Radii where R_nl changes sign (the spherical nodes), found by bracketing
// the n - l - 1 roots of the Laguerre polynomial and bisecting.
export function radialNodes(n, l) {
  const k = n - l - 1;
  if (k === 0) return [];
  const f = (r) => laguerre(k, 2 * l + 1, (2 * r) / n);
  const roots = [];
  const rMax = n * (2 * n + 10);
  const steps = 20000;
  let a = 1e-9;
  let fa = f(a);
  for (let i = 1; i <= steps && roots.length < k; i++) {
    const b = (rMax * i) / steps;
    const fb = f(b);
    if (fa === 0) roots.push(a);
    else if (fa * fb < 0) {
      let lo = a;
      let hi = b;
      let flo = fa;
      for (let it = 0; it < 80; it++) {
        const mid = 0.5 * (lo + hi);
        const fm = f(mid);
        if (flo * fm <= 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      roots.push(0.5 * (lo + hi));
    }
    a = b;
    fa = fb;
  }
  return roots;
}

// Cumulative radial probability on a grid, used for sampling and for the
// radius that encloses a given share of the electron.
export function radialTable(n, l, samples = 4096) {
  const rMax = n * (3 * n + 20);
  const r = new Float64Array(samples);
  const p = new Float64Array(samples);
  const cdf = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    r[i] = (rMax * i) / (samples - 1);
    p[i] = radialDensity(n, l, r[i]);
  }
  for (let i = 1; i < samples; i++) cdf[i] = cdf[i - 1] + 0.5 * (p[i] + p[i - 1]) * (r[i] - r[i - 1]);
  const total = cdf[samples - 1];
  for (let i = 0; i < samples; i++) cdf[i] /= total;
  let peak = 0;
  for (let i = 1; i < samples; i++) if (p[i] > p[peak]) peak = i;
  return { r, p, cdf, rMax, total, peakRadius: r[peak] };
}

// Radius inside which the electron is found with the given probability.
export function enclosingRadius(table, share) {
  const { r, cdf } = table;
  let lo = 0;
  let hi = cdf.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < share) lo = mid;
    else hi = mid;
  }
  const t = (share - cdf[lo]) / (cdf[hi] - cdf[lo] || 1);
  return r[lo] + t * (r[hi] - r[lo]);
}

// Most probable radius, refined from the grid peak by golden-section search.
export function mostProbableRadius(n, l, table = radialTable(n, l)) {
  const step = table.r[1] - table.r[0];
  let a = Math.max(0, table.peakRadius - step);
  let b = table.peakRadius + step;
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 100; i++) {
    const c = b - g * (b - a);
    const d = a + g * (b - a);
    if (radialDensity(n, l, c) > radialDensity(n, l, d)) b = d;
    else a = c;
  }
  return 0.5 * (a + b);
}
