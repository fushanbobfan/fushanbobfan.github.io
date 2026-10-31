// The 17 wallpaper groups, written as in the International Tables: each
// operation maps fractional coordinates (x, y) of the conventional cell to
// M (x, y) + t. M is an integer matrix [[a, b], [c, d]] and t a translation in
// cell units. Centred groups list the operations of the primitive half once and
// add the centring vector (1/2, 1/2) separately.

const H = 0.5;

const op = (a, b, c, d, tx = 0, ty = 0) => ({ m: [a, b, c, d], t: [tx, ty] });

const ID = op(1, 0, 0, 1);
const ROT2 = op(-1, 0, 0, -1);

const P3 = [ID, op(0, -1, 1, -1), op(-1, 1, -1, 0)];
const P6_EXTRA = [ROT2, op(0, 1, -1, 1), op(1, -1, 1, 0)];
const M3_A = [op(0, -1, -1, 0), op(-1, 1, 0, 1), op(1, 0, 1, -1)]; // mirrors through the 3-fold centres
const M3_B = [op(0, 1, 1, 0), op(1, -1, 0, -1), op(-1, 0, -1, 1)]; // mirrors between them
const P4 = [ID, ROT2, op(0, -1, 1, 0), op(0, 1, -1, 0)];

export const GROUPS = [
  { id: 'p1', orbifold: 'o', lattice: 'oblique', ops: [ID] },
  { id: 'p2', orbifold: '2222', lattice: 'oblique', ops: [ID, ROT2] },
  { id: 'pm', orbifold: '**', lattice: 'rectangular', ops: [ID, op(-1, 0, 0, 1)] },
  { id: 'pg', orbifold: 'xx', lattice: 'rectangular', ops: [ID, op(-1, 0, 0, 1, 0, H)] },
  { id: 'cm', orbifold: '*x', lattice: 'rectangular', centred: true, ops: [ID, op(-1, 0, 0, 1)] },
  { id: 'pmm', orbifold: '*2222', lattice: 'rectangular', ops: [ID, ROT2, op(-1, 0, 0, 1), op(1, 0, 0, -1)] },
  { id: 'pmg', orbifold: '22*', lattice: 'rectangular', ops: [ID, ROT2, op(-1, 0, 0, 1, H, 0), op(1, 0, 0, -1, H, 0)] },
  { id: 'pgg', orbifold: '22x', lattice: 'rectangular', ops: [ID, ROT2, op(-1, 0, 0, 1, H, H), op(1, 0, 0, -1, H, H)] },
  { id: 'cmm', orbifold: '2*22', lattice: 'rectangular', centred: true, ops: [ID, ROT2, op(-1, 0, 0, 1), op(1, 0, 0, -1)] },
  { id: 'p4', orbifold: '442', lattice: 'square', ops: P4 },
  { id: 'p4m', orbifold: '*442', lattice: 'square', ops: [...P4, op(-1, 0, 0, 1), op(1, 0, 0, -1), op(0, 1, 1, 0), op(0, -1, -1, 0)] },
  { id: 'p4g', orbifold: '4*2', lattice: 'square', ops: [...P4, op(-1, 0, 0, 1, H, H), op(1, 0, 0, -1, H, H), op(0, 1, 1, 0, H, H), op(0, -1, -1, 0, H, H)] },
  { id: 'p3', orbifold: '333', lattice: 'hexagonal', ops: P3 },
  { id: 'p3m1', orbifold: '*333', lattice: 'hexagonal', ops: [...P3, ...M3_A] },
  { id: 'p31m', orbifold: '3*3', lattice: 'hexagonal', ops: [...P3, ...M3_B] },
  { id: 'p6', orbifold: '632', lattice: 'hexagonal', ops: [...P3, ...P6_EXTRA] },
  { id: 'p6m', orbifold: '*632', lattice: 'hexagonal', ops: [...P3, ...P6_EXTRA, ...M3_A, ...M3_B] },
];

export const byId = (id) => GROUPS.find((g) => g.id === id);

// Every operation of the conventional cell, the centring copies included.
export function cellOps(group) {
  if (!group.centred) return group.ops;
  return [...group.ops, ...group.ops.map((o) => ({ m: o.m, t: [o.t[0] + H, o.t[1] + H] }))];
}

export function apply(o, [x, y]) {
  const [a, b, c, d] = o.m;
  return [a * x + b * y + o.t[0], c * x + d * y + o.t[1]];
}

export function compose(f, g) {
  // f after g
  const [a, b, c, d] = f.m;
  const [e, k, l, n] = g.m;
  const t = apply({ m: f.m, t: [0, 0] }, g.t);
  return { m: [a * e + b * l, a * k + b * n, c * e + d * l, c * k + d * n], t: [t[0] + f.t[0], t[1] + f.t[1]] };
}

const frac = (v) => v - Math.floor(v + 1e-9);

// Two operations are the same symmetry when they differ by a lattice translation.
export function sameModLattice(f, g) {
  return f.m.every((v, i) => v === g.m[i]) && f.t.every((v, i) => Math.abs(frac(v - g.t[i])) < 1e-9);
}

export const det = (o) => o.m[0] * o.m[3] - o.m[1] * o.m[2];

// Lattice bases in the plane. `shape` sets the free parameters: the
// rectangular aspect, or the oblique cell's second vector.
export function basis(lattice, shape = {}) {
  switch (lattice) {
    case 'oblique': {
      const r = shape.ratio ?? 0.85;
      const g = ((shape.angle ?? 74) * Math.PI) / 180;
      return [[1, 0], [r * Math.cos(g), r * Math.sin(g)]];
    }
    case 'rectangular':
      return [[1, 0], [0, shape.ratio ?? 0.7]];
    case 'square':
      return [[1, 0], [0, 1]];
    case 'hexagonal':
      return [[1, 0], [-0.5, Math.sqrt(3) / 2]];
    default:
      throw new Error(`unknown lattice ${lattice}`);
  }
}

// The operation as a Cartesian affine map [a, b, c, d, e, f] in the order
// canvas setTransform expects: x' = a x + c y + e, y' = b x + d y + f.
export function cartesian(o, B) {
  const [[ax, ay], [bx, by]] = B;
  const det0 = ax * by - bx * ay;
  const inv = [by / det0, -bx / det0, -ay / det0, ax / det0]; // rows of B^-1 with B columns a, b
  const [p, q, r, s] = o.m;
  // C = B M B^-1, with B = [[ax, bx], [ay, by]]
  const m00 = ax * p + bx * r, m01 = ax * q + bx * s;
  const m10 = ay * p + by * r, m11 = ay * q + by * s;
  const c00 = m00 * inv[0] + m01 * inv[2], c01 = m00 * inv[1] + m01 * inv[3];
  const c10 = m10 * inv[0] + m11 * inv[2], c11 = m10 * inv[1] + m11 * inv[3];
  const e = ax * o.t[0] + bx * o.t[1];
  const f = ay * o.t[0] + by * o.t[1];
  return [c00, c10, c01, c11, e, f];
}

export function toFrac([x, y], B) {
  const [[ax, ay], [bx, by]] = B;
  const d = ax * by - bx * ay;
  return [(x * by - y * bx) / d, (ax * y - ay * x) / d];
}

export function toCart([u, v], B) {
  return [B[0][0] * u + B[1][0] * v, B[0][1] * u + B[1][1] * v];
}
