// Penrose tilings by Robinson triangle substitution.
//
// Every Penrose tile is cut into two mirror-image triangles. A triangle is
// { kind, a, b, c } with points as [x, y]; `a` is always the apex, the
// vertex between the two equal sides. Substitution replaces each triangle
// by smaller triangles scaled down by the golden ratio, so repeating it
// grows a patch of ever smaller tiles inside a fixed outline.
//
// Kites and darts (P2): the halves of a tile meet along the axis a-c.
//   half kite: golden triangle, a = tip (36 deg), b = wing, c = tail
//   half dart: golden gnomon,   a = dent (108 deg), b = wing, c = tip
// Rhombi (P3): the halves of a tile meet along the base b-c.
//   half thin rhombus:  golden triangle, a = acute corner (36 deg)
//   half thick rhombus: golden gnomon,   a = obtuse corner (108 deg)

export const PHI = (1 + Math.sqrt(5)) / 2;

export const SYSTEMS = {
  p2: { name: 'Kites and darts', kinds: ['kite', 'dart'], seam: 'ac' },
  p3: { name: 'Rhombi', kinds: ['thin', 'thick'], seam: 'bc' },
};

const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const tri = (kind, a, b, c) => ({ kind, a, b, c });

function subdivideOne(t) {
  const { a, b, c } = t;
  const g = 1 / PHI;
  switch (t.kind) {
    case 'kite': {
      const d = lerp(a, c, g);
      const e = lerp(b, a, g);
      return [tri('kite', b, c, d), tri('kite', b, e, d), tri('dart', e, d, a)];
    }
    case 'dart': {
      const e = lerp(c, b, g);
      return [tri('kite', c, e, a), tri('dart', e, a, b)];
    }
    case 'thin': {
      const p = lerp(a, b, g);
      return [tri('thin', c, p, b), tri('thick', p, c, a)];
    }
    case 'thick': {
      const q = lerp(b, a, g);
      const r = lerp(b, c, g);
      return [tri('thick', r, c, a), tri('thick', q, r, b), tri('thin', r, q, a)];
    }
    default:
      throw new Error(`unknown triangle kind: ${t.kind}`);
  }
}

export function subdivide(triangles) {
  const out = [];
  for (const t of triangles) {
    for (const s of subdivideOne(t)) out.push(s);
  }
  return out;
}

const polar = (r, angle) => [r * Math.cos(angle), r * Math.sin(angle)];

// Ten triangles around the origin, alternating in mirror image so that
// neighbours pair up into whole tiles across the seam named by the system.
function wheel(kind, apexAtCentre, flipOdd) {
  const out = [];
  for (let i = 0; i < 10; i++) {
    let p = polar(1, ((2 * i - 1) * Math.PI) / 10);
    let q = polar(1, ((2 * i + 1) * Math.PI) / 10);
    if ((i % 2 === 1) === flipOdd) [p, q] = [q, p];
    out.push(apexAtCentre ? tri(kind, [0, 0], p, q) : tri(kind, p, q, [0, 0]));
  }
  return out;
}

export const SEEDS = {
  'p2-sun': {
    system: 'p2',
    name: 'Sun',
    note: 'five kites with their tips together',
    build: () => wheel('kite', true, true),
  },
  'p2-star': {
    system: 'p2',
    name: 'Star',
    note: 'five darts with their tips together',
    build: () =>
      wheel('kite', true, true).map(({ a, b, c }) => {
        // A half dart whose tip sits at the centre: shrink the half kite's
        // tail inwards to the dent.
        return tri('dart', lerp(a, c, 1 / PHI), b, a);
      }),
  },
  'p3-sun': {
    system: 'p3',
    name: 'Sun',
    note: 'ten thin half rhombi around a point',
    build: () => wheel('thin', true, false),
  },
  'p3-star': {
    system: 'p3',
    name: 'Star',
    note: 'five thick rhombi with their acute corners together',
    build: () => {
      // Each rhombus has its long diagonal running out from the centre and
      // its obtuse corners 36 degrees either side of it.
      const out = [];
      for (let k = 0; k < 5; k++) {
        const angle = (k * 2 * Math.PI) / 5 + Math.PI / 2;
        const far = polar(1, angle);
        for (const side of [-1, 1]) {
          const apex = polar(1 / PHI, angle + (side * Math.PI) / 5);
          out.push(tri('thick', apex, [0, 0], far));
        }
      }
      return out;
    },
  },
};

export function seedsFor(system) {
  return Object.entries(SEEDS)
    .filter(([, s]) => s.system === system)
    .map(([id, s]) => ({ id, ...s }));
}

export function grow(seedId, generations) {
  const seed = SEEDS[seedId];
  if (!seed) throw new Error(`unknown seed: ${seedId}`);
  let tris = seed.build();
  for (let g = 0; g < generations; g++) tris = subdivide(tris);
  return tris;
}

// Lengths shrink by PHI per generation, so tile counts grow by PHI^2.
export function edgeLength(generations) {
  return Math.pow(PHI, -generations);
}

const keyOf = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
const edgeKey = (p, q) => {
  const kp = keyOf(p);
  const kq = keyOf(q);
  return kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
};

export const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);

// Join mirror-image halves into whole tiles. Halves whose partner lies
// outside the patch are returned separately.
export function assemble(triangles, system) {
  const seam = SYSTEMS[system].seam;
  const open = new Map();
  const tiles = [];
  for (const t of triangles) {
    const [p, q] = seam === 'ac' ? [t.a, t.c] : [t.b, t.c];
    const key = `${t.kind}:${edgeKey(p, q)}`;
    const mate = open.get(key);
    if (!mate) {
      open.set(key, t);
      continue;
    }
    open.delete(key);
    tiles.push(joinHalves(mate, t, seam));
  }
  return { tiles, halves: [...open.values()] };
}

function joinHalves(s, t, seam) {
  // Outline the quadrilateral going round the seam: s's free corner, one
  // seam end, t's free corner, the other seam end.
  let points;
  let centre;
  if (seam === 'ac') {
    points = [s.a, s.b, s.c, t.b];
    centre = lerp(s.a, s.c, 0.5);
  } else {
    points = [s.a, s.b, t.a, s.c];
    centre = lerp(s.a, t.a, 0.5);
  }
  if (polygonArea(points) < 0) points = [points[0], points[3], points[2], points[1]];
  return { kind: s.kind, points, centre, axis: axisAngle(s, seam) };
}

// Direction of the tile's mirror axis, in degrees from 0 up to 360. Penrose
// tiles only ever point in multiples of 36 degrees.
function axisAngle(t, seam) {
  const [from, to] = seam === 'ac' ? [t.a, t.c] : [t.a, lerp(t.b, t.c, 0.5)];
  const deg = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function polygonArea(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

export function triangleArea(t) {
  return Math.abs(cross(t.a, t.b, t.c)) / 2;
}

export function countKinds(items) {
  const counts = {};
  for (const it of items) counts[it.kind] = (counts[it.kind] || 0) + 1;
  return counts;
}
