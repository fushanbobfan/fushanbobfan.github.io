// Lagrange points of the two most massive bodies: the five spots where a light third body can
// sit still relative to the pair as it orbits. Computed in the circular restricted three-body
// model, so they are exact for a circular orbit and a good approximation for a nearly circular
// one; the positions are recomputed from the pair's current geometry every time they're asked
// for, so on an eccentric orbit they breathe in and out with the separation.
//
// No DOM or canvas dependency, so this can be tested on its own.

/**
 * The two heaviest bodies, heaviest first, or null if there aren't two bodies with mass.
 * @param {{mass:number}[]} bodies
 */
export function pickPrimaryPair(bodies) {
  if (!Array.isArray(bodies) || bodies.length < 2) return null;
  let primary = null;
  let secondary = null;
  for (const body of bodies) {
    if (!(body.mass > 0)) continue;
    if (primary === null || body.mass > primary.mass) {
      secondary = primary;
      primary = body;
    } else if (secondary === null || body.mass > secondary.mass) {
      secondary = body;
    }
  }
  return primary && secondary ? [primary, secondary] : null;
}

// Net "force" along the axis in the rotating barycentric frame with the separation as the
// unit of length: centrifugal pull outward minus the two bodies' gravity. The collinear
// points are its roots. `mu` is the secondary's share of the total mass, so the primary sits
// at x = -mu and the secondary at x = 1 - mu.
function axialBalance(x, mu) {
  const dPrimary = x + mu;
  const dSecondary = x - 1 + mu;
  return (
    x -
    ((1 - mu) * dPrimary) / Math.abs(dPrimary) ** 3 -
    (mu * dSecondary) / Math.abs(dSecondary) ** 3
  );
}

// Bisection: `axialBalance` has exactly one root in each of the three open intervals between
// and beyond the bodies, and it changes sign across each, so the root is bracketed from the
// start. The tiny inset keeps the endpoints off the singularities at the bodies themselves.
function bisectRoot(lo, hi, mu, iterations = 80) {
  let fLo = axialBalance(lo, mu);
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const fMid = axialBalance(mid, mu);
    if (fMid === 0) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * The five points in barycentric rotating-frame coordinates, with the separation as the unit
 * of length and the primary on the negative x axis. Exposed for tests and for anyone who wants
 * the dimensionless numbers.
 * @param {number} mu secondary mass / total mass, in (0, 1)
 */
export function normalizedLagrangePoints(mu) {
  if (!(mu > 0 && mu < 1)) throw new RangeError("mu must be strictly between 0 and 1");
  const inset = 1e-9;
  const primaryX = -mu;
  const secondaryX = 1 - mu;
  return {
    L1: { x: bisectRoot(primaryX + inset, secondaryX - inset, mu), y: 0 },
    L2: { x: bisectRoot(secondaryX + inset, secondaryX + 2, mu), y: 0 },
    L3: { x: bisectRoot(primaryX - 2, primaryX - inset, mu), y: 0 },
    L4: { x: 0.5 - mu, y: Math.sqrt(3) / 2 },
    L5: { x: 0.5 - mu, y: -Math.sqrt(3) / 2 },
  };
}

/**
 * The five Lagrange points of `primary` and `secondary` in world coordinates at this instant.
 * L4 sits 60 degrees counterclockwise from the secondary as seen from the primary (in the
 * canvas's y-down coordinates that is clockwise on screen), L5 the other way.
 * @param {{mass:number,x:number,y:number}} primary
 * @param {{mass:number,x:number,y:number}} secondary
 * @returns {{L1:{x,y},L2:{x,y},L3:{x,y},L4:{x,y},L5:{x,y}} | null} null if the bodies coincide
 */
export function lagrangePoints(primary, secondary) {
  const dx = secondary.x - primary.x;
  const dy = secondary.y - primary.y;
  const separation = Math.hypot(dx, dy);
  const total = primary.mass + secondary.mass;
  if (!(separation > 0) || !(total > 0)) return null;
  const mu = secondary.mass / total;
  if (!(mu > 0 && mu < 1)) return null;

  // Unit vector along the axis and its perpendicular, plus the barycenter as the origin.
  const ux = dx / separation;
  const uy = dy / separation;
  const vx = -uy;
  const vy = ux;
  const cx = primary.x + mu * dx;
  const cy = primary.y + mu * dy;

  const normalized = normalizedLagrangePoints(mu);
  const out = {};
  for (const [name, p] of Object.entries(normalized)) {
    const rx = p.x * separation;
    const ry = p.y * separation;
    out[name] = { x: cx + rx * ux + ry * vx, y: cy + rx * uy + ry * vy };
  }
  return out;
}
