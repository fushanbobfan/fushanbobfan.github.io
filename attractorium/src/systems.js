// Continuous three-dimensional flows with strange attractors. Each system gives
// its vector field, named parameters with ranges, a step size that keeps RK4
// accurate at the default parameters, a starting point inside the basin, the
// axis drawn upward (also the default return-map coordinate unless mapAxis
// says otherwise), and its full set of equilibria where they have a closed
// form (null otherwise). Slow flows set how long a stretch of orbit the page
// draws as the backdrop (orbitTime). sweepKey names the parameter the
// bifurcation diagram sweeps by default.

const sqrt = Math.sqrt;

export const SYSTEMS = {
  lorenz: {
    name: 'Lorenz',
    year: 1963,
    equations: ['dx/dt = σ(y − x)', 'dy/dt = x(ρ − z) − y', 'dz/dt = xy − βz'],
    params: [
      { key: 'sigma', label: 'σ', value: 10, min: 0.5, max: 30, step: 0.1 },
      { key: 'rho', label: 'ρ', value: 28, min: 0.5, max: 200, step: 0.1 },
      { key: 'beta', label: 'β', value: 8 / 3, min: 0.1, max: 8, step: 0.01 },
    ],
    dt: 0.005,
    start: [1, 1, 20],
    sweepKey: 'rho',
    up: 2,
    note: 'Two lobes around the equilibria C± with the trajectory switching sides at irregular times. Below ρ ≈ 24.74 the equilibria C± are stable as well, and below about 24.06 the chaos is gone and orbits spiral into them; near ρ = 99.65 and ρ = 160 the flow settles on periodic orbits.',
    field(p, s, out) {
      out[0] = p.sigma * (s[1] - s[0]);
      out[1] = s[0] * (p.rho - s[2]) - s[1];
      out[2] = s[0] * s[1] - p.beta * s[2];
    },
    equilibria(p) {
      const eq = [[0, 0, 0]];
      if (p.rho > 1) {
        const r = sqrt(p.beta * (p.rho - 1));
        eq.push([r, r, p.rho - 1], [-r, -r, p.rho - 1]);
      }
      return eq;
    },
  },

  rossler: {
    name: 'Rössler',
    year: 1976,
    equations: ['dx/dt = −y − z', 'dy/dt = x + ay', 'dz/dt = b + z(x − c)'],
    params: [
      { key: 'a', label: 'a', value: 0.2, min: 0, max: 0.4, step: 0.001 },
      { key: 'b', label: 'b', value: 0.2, min: 0.01, max: 2, step: 0.01 },
      { key: 'c', label: 'c', value: 5.7, min: 1, max: 18, step: 0.01 },
    ],
    dt: 0.01,
    start: [1, 1, 0],
    sweepKey: 'c',
    up: 2,
    mapAxis: 0,
    note: 'A single spiral that occasionally lifts off and folds back over itself. Raising c from 2.5 walks the period-doubling cascade: one loop, two (c = 3.5), four (c = 4), then chaos.',
    field(p, s, out) {
      out[0] = -s[1] - s[2];
      out[1] = s[0] + p.a * s[1];
      out[2] = p.b + s[2] * (s[0] - p.c);
    },
    equilibria(p) {
      const disc = p.c * p.c - 4 * p.a * p.b;
      if (disc < 0 || p.a === 0) return [];
      return [-1, 1].map((sign) => {
        const x = (p.c + sign * sqrt(disc)) / 2;
        return [x, -x / p.a, x / p.a];
      });
    },
  },

  chen: {
    name: 'Chen',
    year: 1999,
    equations: ['dx/dt = a(y − x)', 'dy/dt = (c − a)x − xz + cy', 'dz/dt = xy − bz'],
    params: [
      { key: 'a', label: 'a', value: 35, min: 20, max: 50, step: 0.1 },
      { key: 'b', label: 'b', value: 3, min: 0.5, max: 6, step: 0.01 },
      { key: 'c', label: 'c', value: 28, min: 15, max: 35, step: 0.1 },
    ],
    dt: 0.002,
    start: [-10, 0, 37],
    sweepKey: 'c',
    up: 2,
    note: 'A close relative of Lorenz with the same left-right symmetry; the −y damping in the second equation becomes +cy, and the two wings are wound more tightly.',
    field(p, s, out) {
      out[0] = p.a * (s[1] - s[0]);
      out[1] = (p.c - p.a) * s[0] - s[0] * s[2] + p.c * s[1];
      out[2] = s[0] * s[1] - p.b * s[2];
    },
    equilibria(p) {
      const eq = [[0, 0, 0]];
      const q = p.b * (2 * p.c - p.a);
      if (q > 0) {
        const r = sqrt(q);
        eq.push([r, r, 2 * p.c - p.a], [-r, -r, 2 * p.c - p.a]);
      }
      return eq;
    },
  },

  thomas: {
    name: 'Thomas',
    year: 1999,
    equations: ['dx/dt = sin y − bx', 'dy/dt = sin z − by', 'dz/dt = sin x − bz'],
    params: [{ key: 'b', label: 'b', value: 0.208186, min: 0.05, max: 0.33, step: 0.0001 }],
    dt: 0.05,
    start: [0.1, 0, 0],
    orbitTime: 4000,
    sweepKey: 'b',
    up: 2,
    note: 'Cyclically symmetric under x → y → z → x. As the friction b drops toward 0 the attractor fills more of the lattice of cells; at b = 0 the orbit wanders through it like a random walk.',
    field(p, s, out) {
      out[0] = Math.sin(s[1]) - p.b * s[0];
      out[1] = Math.sin(s[2]) - p.b * s[1];
      out[2] = Math.sin(s[0]) - p.b * s[2];
    },
    equilibria: null,
  },

  halvorsen: {
    name: 'Halvorsen',
    year: null,
    equations: ['dx/dt = −ax − 4y − 4z − y²', 'dy/dt = −ay − 4z − 4x − z²', 'dz/dt = −az − 4x − 4y − x²'],
    params: [{ key: 'a', label: 'a', value: 1.4, min: 1, max: 2.2, step: 0.001 }],
    dt: 0.005,
    start: [-1.48, -1.51, 2.04],
    sweepKey: 'a',
    up: 2,
    note: 'Three interlocking lobes related by the same cyclic symmetry as Thomas; look along the diagonal x = y = z to see it. Raise a to 1.89, a value often quoted for this system, and the orbit from the default start locks onto a periodic loop instead.',
    field(p, s, out) {
      const [x, y, z] = s;
      out[0] = -p.a * x - 4 * y - 4 * z - y * y;
      out[1] = -p.a * y - 4 * z - 4 * x - z * z;
      out[2] = -p.a * z - 4 * x - 4 * y - x * x;
    },
    equilibria: null,
  },

  aizawa: {
    name: 'Aizawa',
    year: null,
    equations: [
      'dx/dt = (z − b)x − dy',
      'dy/dt = dx + (z − b)y',
      'dz/dt = c + az − z³/3 − (x² + y²)(1 + ez) + fzx³',
    ],
    params: [
      { key: 'a', label: 'a', value: 0.95, min: 0.5, max: 1.2, step: 0.001 },
      { key: 'b', label: 'b', value: 0.7, min: 0.3, max: 1.2, step: 0.001 },
      { key: 'c', label: 'c', value: 0.6, min: 0.2, max: 1, step: 0.001 },
      { key: 'd', label: 'd', value: 3.5, min: 1, max: 6, step: 0.01 },
      { key: 'e', label: 'e', value: 0.25, min: 0, max: 0.6, step: 0.001 },
      { key: 'f', label: 'f', value: 0.1, min: 0, max: 0.3, step: 0.001 },
    ],
    dt: 0.01,
    start: [0.1, 0, 0],
    orbitTime: 600,
    sweepKey: 'a',
    up: 2,
    note: 'A sphere-like shell with a tube through its axis: the orbit spirals over the surface and is thrown back down the tube. The x³ term breaks the rotational symmetry.',
    field(p, s, out) {
      const [x, y, z] = s;
      out[0] = (z - p.b) * x - p.d * y;
      out[1] = p.d * x + (z - p.b) * y;
      out[2] = p.c + p.a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + p.e * z) + p.f * z * x * x * x;
    },
    equilibria(p) {
      // On the axis x = y = 0 the last equation is the cubic c + az − z³/3 = 0.
      return cubicRoots(p).map((z) => [0, 0, z]);
    },
  },

  dadras: {
    name: 'Dadras',
    year: 2009,
    equations: ['dx/dt = y − ax + byz', 'dy/dt = cy − xz + z', 'dz/dt = dxy − ez'],
    params: [
      { key: 'a', label: 'a', value: 3, min: 1, max: 5, step: 0.01 },
      { key: 'b', label: 'b', value: 2.7, min: 1, max: 4, step: 0.01 },
      { key: 'c', label: 'c', value: 1.7, min: 0.5, max: 3, step: 0.01 },
      { key: 'd', label: 'd', value: 2, min: 0.5, max: 4, step: 0.01 },
      { key: 'e', label: 'e', value: 9, min: 4, max: 12, step: 0.01 },
    ],
    dt: 0.005,
    start: [1.1, 2.1, -2],
    sweepKey: 'e',
    up: 2,
    note: 'Scrolls wound around the origin and visited in an order that never repeats.',
    field(p, s, out) {
      const [x, y, z] = s;
      out[0] = y - p.a * x + p.b * y * z;
      out[1] = p.c * y - x * z + z;
      out[2] = p.d * x * y - p.e * z;
    },
    equilibria: null,
  },
};

export const SYSTEM_KEYS = Object.keys(SYSTEMS);

export function defaultParams(key) {
  const out = {};
  for (const q of SYSTEMS[key].params) out[q.key] = q.value;
  return out;
}

// Real roots of c + az − z³/3 = 0, found by bisection on the intervals the
// cubic's turning points (z = ±√a) split the line into.
function cubicRoots(p) {
  const g = (z) => p.c + p.a * z - (z * z * z) / 3;
  const t = sqrt(Math.max(p.a, 0));
  const edges = [-20, -t, t, 20];
  const roots = [];
  for (let i = 0; i < 3; i++) {
    let lo = edges[i];
    let hi = edges[i + 1];
    if (hi <= lo) continue;
    let glo = g(lo);
    if (glo === 0) {
      roots.push(lo);
      continue;
    }
    if (glo * g(hi) > 0) continue;
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      const gm = g(mid);
      if (gm * glo <= 0) hi = mid;
      else {
        lo = mid;
        glo = gm;
      }
    }
    roots.push((lo + hi) / 2);
  }
  return roots;
}
