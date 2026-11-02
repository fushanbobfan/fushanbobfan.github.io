// Why the plane turns at Ω sin φ: the cone that touches the Earth along the
// pendulum's circle of latitude.
//
// Over a day the pendulum is carried once around its parallel. The cone
// tangent to the globe along that parallel can be cut and laid flat without
// stretching, and on the flat sheet a swing that is never twisted keeps one
// direction. Rolled back up, the sheet is a sector of angle 2π |sin φ|, so
// after a full trip the local north has turned that far relative to the swing.

const RAD = Math.PI / 180;

// The cone (or, at the equator, the cylinder) for a globe of radius R.
// Heights are along the polar axis from the centre, north positive.
export function tangentCone(latDeg, R = 1) {
  const s = Math.sin(latDeg * RAD), c = Math.cos(latDeg * RAD);
  const ring = { radius: R * c, height: R * s };
  if (Math.abs(s) < 1e-9) return { kind: 'cylinder', ring, sector: 0, slant: Infinity, apex: Infinity };
  return {
    kind: 'cone',
    ring,
    apex: R / s, // where the cone meets the axis
    slant: (R * c) / Math.abs(s), // from the apex to the parallel, along the cone
    sector: 2 * Math.PI * Math.abs(s), // angle of the sheet laid flat
  };
}

// Angle the local north has turned past the swing after a fraction of a day,
// positive when the swing turns clockwise seen from above (the north).
export function turnedAfter(latDeg, dayFraction) {
  return 2 * Math.PI * Math.sin(latDeg * RAD) * dayFraction;
}

// The flattened sheet with its apex at the origin and the parallel on the
// circle of radius `slant`, centred on the downward direction. Returns where
// the pendulum is after a fraction of a day, the local north there and the
// swing, which keeps the direction north had at the start.
export function onSheet(latDeg, dayFraction, R = 1) {
  const cone = tangentCone(latDeg, R);
  if (cone.kind === 'cylinder') {
    // the cylinder unrolls into a strip; north is the same everywhere
    const x = 2 * Math.PI * R * (dayFraction - 0.5);
    return { cone, x, y: 0, north: { x: 0, y: 1 }, swing: { x: 0, y: 1 }, turned: 0, start: { x: -Math.PI * R, y: 0 } };
  }
  const sign = latDeg > 0 ? 1 : -1;
  const a0 = -Math.PI / 2 - (sign * cone.sector) / 2;
  const at = (f) => a0 + sign * cone.sector * f;
  const point = (f) => ({ x: cone.slant * Math.cos(at(f)), y: cone.slant * Math.sin(at(f)) });
  const p = point(dayFraction), s0 = point(0);
  // north runs up the cone towards the apex in the north, away from it in the south
  const n = (q) => {
    const r = Math.hypot(q.x, q.y);
    return { x: (-sign * q.x) / r, y: (-sign * q.y) / r };
  };
  return { cone, x: p.x, y: p.y, north: n(p), swing: n(s0), turned: turnedAfter(latDeg, dayFraction), start: s0, a0, sign };
}
