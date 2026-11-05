// The bifurcation set: the control points where a well and a hill of the energy
// meet and vanish, V' = V'' = 0.
//
// For each pin angle the fixed band's torque must be balanced by the moving band.
// Write C = pin + L (alpha R + beta T), with R and T the radial and tangent units
// at the pin, and alpha = sin(phi), |beta| = cos(phi). The moving band's torque is
// -s (L - l) r beta, so V' = 0 gives the stretch from phi, which leaves V'' as a
// function of phi alone. A sign change in that function is a fold point, so
// tracing is a one-dimensional root search per angle.
//
// Stiff machines add one more piece. At theta = pi the fixed band exerts no torque,
// so the moving band can balance it at no stretch at all: the set then includes an
// arc of the circle where that band just goes taut, and V'' jumps across it.

import { fixedBand, pinPosition, thirdDerivative, torque, curvature } from './machine.js';

const TAU = Math.PI * 2;

// Angles phi: dense towards +-pi/2, where beta is tiny and roots crowd near the axis.
const PHI_GRID = (() => {
  const grid = [];
  const ends = [];
  for (let k = 0; k < 44; k += 1) ends.push(1e-6 * Math.exp((k / 44) * Math.log(5e4)));
  for (const d of ends) grid.push(-Math.PI / 2 + d);
  for (let k = 0; k <= 240; k += 1) grid.push(-Math.PI / 2 + 0.05 + (k / 240) * (Math.PI - 0.1));
  for (const d of ends.slice().reverse()) grid.push(Math.PI / 2 - d);
  return grid;
})();

function foldResidual(m, band, phi) {
  const alpha = Math.sin(phi);
  const size = Math.cos(phi);
  const stretch = Math.abs(band.torque) / (m.s * m.r * size);
  const L = m.l + stretch;
  const value = band.curvature + m.s * (m.r * m.r * size * size
    + stretch * ((m.r * m.r * alpha * alpha) / L + m.r * alpha));
  return { value, alpha, beta: Math.sign(band.torque) * size, L };
}

function foldPoint(m, theta, f) {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const u = f.alpha * c - f.beta * sn;
  const v = f.alpha * sn + f.beta * c;
  return { x: m.r * c + f.L * u, y: m.r * sn + f.L * v, theta, stretch: f.L - m.l };
}

// Every fold point at this pin angle with the moving band shorter than maxLength.
export function foldPointsAt(m, theta, maxLength = 8) {
  const band = fixedBand(m, theta);
  if (band.torque === 0) return [];
  const points = [];
  let phi0 = PHI_GRID[0];
  let f0 = foldResidual(m, band, phi0).value;
  for (let j = 1; j < PHI_GRID.length; j += 1) {
    const phi1 = PHI_GRID[j];
    const f1 = foldResidual(m, band, phi1).value;
    if ((f0 > 0) !== (f1 > 0)) {
      let lo = phi0;
      let hi = phi1;
      let fLo = f0;
      for (let k = 0; k < 48; k += 1) {
        const mid = 0.5 * (lo + hi);
        const fMid = foldResidual(m, band, mid).value;
        if ((fMid > 0) === (fLo > 0)) {
          lo = mid;
          fLo = fMid;
        } else {
          hi = mid;
        }
      }
      const root = foldResidual(m, band, 0.5 * (lo + hi));
      if (root.L < maxLength) points.push(foldPoint(m, theta, root));
    }
    phi0 = phi1;
    f0 = f1;
  }
  return points;
}

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

function linkByAngle(m, steps, maxLength, linkTol) {
  const open = [];
  const done = [];
  for (let i = 0; i < steps; i += 1) {
    const theta = -Math.PI + ((i + 0.5) * TAU) / steps;
    const points = foldPointsAt(m, theta, maxLength);
    const taken = new Set();
    const next = [];
    for (const chain of open) {
      const end = chain[chain.length - 1];
      let best = -1;
      let bestDist = linkTol;
      points.forEach((p, k) => {
        const d = dist(p, end);
        if (!taken.has(k) && d < bestDist) {
          best = k;
          bestDist = d;
        }
      });
      if (best >= 0) {
        taken.add(best);
        chain.push(points[best]);
        next.push(chain);
      } else {
        done.push(chain);
      }
    }
    points.forEach((p, k) => {
      if (!taken.has(k)) next.push([p]);
    });
    open.length = 0;
    open.push(...next);
  }
  done.push(...open);
  return done.filter((chain) => chain.length > 1);
}

// The stretch of an end tells a slack arc from an ordinary gap.
function isSlackEnd(m, p, steps) {
  const fromPi = Math.PI - Math.abs(p.theta);
  return fromPi < (3 * TAU) / steps && p.stretch < 0.02;
}

// Points along the circle where the moving band just goes taut with the pin at pi.
function slackArc(m, p, q) {
  const centre = pinPosition(m, Math.PI);
  const a0 = Math.atan2(p.y - centre.y, p.x - centre.x);
  let gap = Math.atan2(q.y - centre.y, q.x - centre.x) - a0;
  if (gap > Math.PI) gap -= TAU;
  if (gap < -Math.PI) gap += TAU;
  const count = Math.max(2, Math.ceil(Math.abs(gap) * 24));
  const arc = [];
  for (let i = 1; i < count; i += 1) {
    const a = a0 + (gap * i) / count;
    arc.push({ x: centre.x + m.l * Math.cos(a), y: centre.y + m.l * Math.sin(a), theta: Math.PI, stretch: 0, slack: true });
  }
  return arc;
}

// Two roots can race together and vanish within one angle step, leaving a wide gap
// across a sharp hairpin. Bisecting the angle towards the point where they vanish
// fills the gap with true fold points.
function hairpin(m, p, q, steps, maxLength) {
  const step = TAU / steps;
  const wrap = (t) => {
    const w = (t + Math.PI) % TAU;
    return (w < 0 ? w + TAU : w) - Math.PI;
  };
  for (const dir of [1, -1]) {
    const side = [];
    const other = [];
    let lastP = p;
    let lastQ = q;
    const pair = (theta) => {
      const roots = foldPointsAt(m, wrap(theta), maxLength);
      if (roots.length < 2) return null;
      const nearest = (to, skip) => roots.reduce((best, r) => (
        r !== skip && (!best || dist(r, to) < dist(best, to)) ? r : best), null);
      const a = nearest(lastP, null);
      const b = nearest(lastQ, a);
      const reach = dist(lastP, lastQ) + 0.05;
      return dist(a, lastP) < reach && dist(b, lastQ) < reach ? [a, b] : null;
    };
    let lo = 0;
    let hi = step;
    if (pair(p.theta + dir * hi)) continue;
    for (let i = 0; i < 26; i += 1) {
      const mid = 0.5 * (lo + hi);
      const found = pair(p.theta + dir * mid);
      if (found) {
        [lastP, lastQ] = found;
        side.push(lastP);
        other.push(lastQ);
        lo = mid;
      } else {
        hi = mid;
      }
    }
    if (side.length) return side.concat(other.reverse());
  }
  return [];
}

// Join chain ends: across the seam at +-pi, at hairpins in theta, and along slack arcs.
function joinEnds(m, chains, steps, linkTol, maxLength) {
  const pieces = chains.slice();
  const closed = [];
  for (;;) {
    let best = null;
    for (let i = 0; i < pieces.length; i += 1) {
      const a = pieces[i];
      for (const [endA, tailA] of [[a[a.length - 1], true], [a[0], false]]) {
        for (let j = i; j < pieces.length; j += 1) {
          const b = pieces[j];
          for (const [endB, headB] of [[b[0], true], [b[b.length - 1], false]]) {
            if (j === i && (tailA !== headB || a.length < 8)) continue;
            const d = dist(endA, endB);
            const sameSide = Math.sign(endA.y) === Math.sign(endB.y);
            const slack = sameSide && isSlackEnd(m, endA, steps) && isSlackEnd(m, endB, steps);
            const pin = sameSide && Math.abs(endA.theta - endB.theta) < (2.5 * TAU) / steps && d < 0.8;
            let kind = null;
            let score = Infinity;
            if (d < linkTol) {
              kind = 'gap';
              score = d;
            } else if (slack) {
              kind = 'slack';
              score = d + 1;
            } else if (pin) {
              kind = 'hairpin';
              score = d + 1;
            }
            if (kind && (!best || score < best.score)) {
              best = { i, j, tailA, headB, endA, endB, score, kind };
            }
          }
        }
      }
    }
    if (!best) break;
    const a = pieces[best.i];
    let arc = [];
    if (best.kind === 'slack') arc = slackArc(m, best.endA, best.endB);
    if (best.kind === 'hairpin') arc = hairpin(m, best.endA, best.endB, steps, maxLength);
    if (best.i === best.j) {
      const loop = best.tailA ? a.concat(arc) : arc.slice().reverse().concat(a);
      closed.push(loop);
      pieces.splice(best.i, 1);
    } else {
      const b = pieces[best.j];
      const front = best.tailA ? a : a.slice().reverse();
      const back = best.headB ? b : b.slice().reverse();
      const merged = front.concat(arc, back);
      pieces.splice(best.j, 1);
      pieces[best.i] = merged;
    }
  }
  return [
    ...closed.map((points) => ({ points, closed: true })),
    ...pieces.map((points) => ({ points, closed: false })),
  ];
}

// Link the fold points of neighbouring angles into polylines in the control plane.
export function traceFoldSet(m, { steps = 1440, maxLength = 8, linkTol = 0.14 } = {}) {
  return joinEnds(m, linkByAngle(m, steps, maxLength, linkTol), steps, linkTol, maxLength);
}

function refineCusp(m, p, q, maxLength) {
  let a = p;
  let b = q;
  const gapOf = (u, v) => {
    const d = v.theta - u.theta;
    return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d;
  };
  let va = thirdDerivative(m, a.x, a.y, a.theta);
  for (let i = 0; i < 40; i += 1) {
    const gap = gapOf(a, b);
    // Off centre by a hair: a bracket symmetric about 0 would land on the exact axis,
    // where the fixed band's torque vanishes and the search has nothing to balance.
    const theta = a.theta + 0.501 * gap;
    const guess = { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y) };
    const candidates = foldPointsAt(m, theta, maxLength);
    if (!candidates.length) break;
    let mid = candidates[0];
    for (const c of candidates) {
      if (dist(c, guess) < dist(mid, guess)) mid = c;
    }
    const v = thirdDerivative(m, mid.x, mid.y, mid.theta);
    if ((v > 0) === (va > 0)) {
      a = mid;
      va = v;
    } else {
      b = mid;
    }
  }
  return { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y), theta: a.theta + 0.5 * gapOf(a, b) };
}

// Cusps of the set: V''' changes sign along a chain of fold points. Corners where
// a slack arc meets the curve are not cusps, so the arcs are skipped.
export function findCusps(m, chains, maxLength = 8) {
  const cusps = [];
  for (const { points, closed } of chains) {
    const count = closed ? points.length : points.length - 1;
    for (let i = 0; i < count; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      if (p.slack || q.slack || p.stretch < 1e-3 || q.stretch < 1e-3) continue;
      const vp = thirdDerivative(m, p.x, p.y, p.theta);
      const vq = thirdDerivative(m, q.x, q.y, q.theta);
      if ((vp > 0) !== (vq > 0)) cusps.push(refineCusp(m, p, q, maxLength));
    }
  }
  return cusps;
}

export function foldResiduals(m, p) {
  return {
    torque: torque(m, p.x, p.y, p.theta),
    curvature: curvature(m, p.x, p.y, p.theta),
  };
}
