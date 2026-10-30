// Geometric optics of light in a spherical drop.
//
// A ray meets the drop at impact parameter x (its offset from the centre in
// drop radii), enters at incidence angle i = asin x and refracts to r with
// sin i = n sin r. Inside, every chord meets the surface at the same angle r,
// so after k internal reflections the ray leaves turned by
//   D = 2(i - r) + k(π - 2r).
// The rainbow angle is measured from the antisolar point, the shadow of the
// observer's head: α = π - Θ, with Θ the scattering angle folded into [0, π].

const TAU = 2 * Math.PI;

export function deviation(x, n, k) {
  const i = Math.asin(x);
  const r = Math.asin(x / n);
  return 2 * (i - r) + k * (Math.PI - 2 * r);
}

export function scatteringAngle(D) {
  const t = ((D % TAU) + TAU) % TAU;
  return t > Math.PI ? TAU - t : t;
}

export function rainbowAngle(x, n, k) {
  return Math.PI - scatteringAngle(deviation(x, n, k));
}

// The deviation is stationary where cos² i = (n² - 1) / (k(k + 2)); light
// piles up there, and that ray is Descartes' rainbow ray.
export function descartesImpact(n, k) {
  const c2 = (n * n - 1) / (k * (k + 2));
  if (c2 >= 1) return null;
  return Math.sqrt(1 - c2);
}

export function bowAngle(n, k) {
  const x = descartesImpact(n, k);
  return x === null ? null : rainbowAngle(x, n, k);
}

// Fresnel power reflectances for light hitting an interface from a medium of
// index n1 into n2 at incidence angle t. Total internal reflection gives 1.
export function fresnel(t, n1, n2) {
  const s = (n1 / n2) * Math.sin(t);
  if (s >= 1) return { rs: 1, rp: 1 };
  const ci = Math.cos(t);
  const ct = Math.sqrt(1 - s * s);
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  const rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
  return { rs: rs * rs, rp: rp * rp };
}

// Fraction of the incoming power that leaves after k internal reflections,
// for light polarized perpendicular (s) and parallel (p) to the plane of
// scattering. Reflectance is the same from either side of the surface, so
// every bounce costs the same factor.
export function orderWeights(x, n, k) {
  const i = Math.asin(x);
  const { rs, rp } = fresnel(i, 1, n);
  return {
    s: (1 - rs) ** 2 * rs ** k,
    p: (1 - rp) ** 2 * rp ** k,
  };
}

// Trace a ray through a unit drop centred at the origin. The ray travels in
// +x at height x; the drop sits at the origin. Returns the surface points it
// visits and the direction it leaves in, using vector refraction and
// reflection only, so it checks the closed form above independently.
export function tracePath(x, n, k) {
  let p = [-Math.sqrt(1 - x * x), x];
  let d = refract([1, 0], p, 1 / n);
  const points = [[-2.5, x], p];
  for (let bounce = 0; bounce <= k; bounce++) {
    const t = -2 * (p[0] * d[0] + p[1] * d[1]);
    p = [p[0] + t * d[0], p[1] + t * d[1]];
    points.push(p);
    if (bounce < k) d = reflect(d, p);
  }
  const out = refract(d, p, n);
  return { points, out };
}

// Refract unit direction d at a point on the unit sphere with outward normal
// p, where eta is n(before) / n(after).
function refract(d, p, eta) {
  let nx = p[0];
  let ny = p[1];
  let c = -(d[0] * nx + d[1] * ny);
  if (c < 0) {
    nx = -nx;
    ny = -ny;
    c = -c;
  }
  const k = 1 - eta * eta * (1 - c * c);
  const f = eta * c - Math.sqrt(Math.max(0, k));
  return [eta * d[0] + f * nx, eta * d[1] + f * ny];
}

function reflect(d, p) {
  const dot = d[0] * p[0] + d[1] * p[1];
  return [d[0] - 2 * dot * p[0], d[1] - 2 * dot * p[1]];
}
