// The bifurcation set: the control points where a well and a hill of the energy
// meet and vanish, V' = V'' = 0.
//
// For each pin angle the fixed band's torque must be balanced by the moving band.
// Write C = pin + L (alpha R + beta T), with R and T the radial and tangent units
// at the pin. The moving band's torque is -s (L - l) r beta, so V' = 0 gives beta
// from the stretch, which leaves V'' as a function of the stretch alone on each
// of the two branches alpha = +-sqrt(1 - beta^2). A sign change in that function
// is a fold point. Tracing is then a one-dimensional root search per angle.

import { curvature, fixedBand, thirdDerivative, torque } from './machine.js';

const TAU = Math.PI * 2;
const SCAN = 120;

function foldResidual(m, band, stretch, branch) {
  const beta = band.torque / (m.s * m.r * stretch);
  const alpha = branch * Math.sqrt(Math.max(0, 1 - beta * beta));
  const L = m.l + stretch;
  const value = band.curvature + m.s * (m.r * m.r * beta * beta
    + stretch * ((m.r * m.r * alpha * alpha) / L + m.r * alpha));
  return { value, alpha, beta, L };
}

function foldPoint(m, theta, f) {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const u = f.alpha * c - f.beta * sn;
  const v = f.alpha * sn + f.beta * c;
  return { x: m.r * c + f.L * u, y: m.r * sn + f.L * v, theta };
}

// Every fold point at this pin angle with the moving band shorter than maxLength.
export function foldPointsAt(m, theta, maxLength = 8) {
  const band = fixedBand(m, theta);
  const least = Math.max(Math.abs(band.torque) / (m.s * m.r), 1e-9);
  const span = maxLength - m.l - least;
  if (span <= 0) return [];
  const points = [];
  for (const branch of [-1, 1]) {
    let s0 = least;
    let f0 = foldResidual(m, band, s0, branch).value;
    for (let j = 1; j <= SCAN; j += 1) {
      const s1 = least + span * (j / SCAN) ** 2;
      const f1 = foldResidual(m, band, s1, branch).value;
      if ((f0 > 0) !== (f1 > 0)) {
        let lo = s0;
        let hi = s1;
        let fLo = f0;
        for (let k = 0; k < 48; k += 1) {
          const mid = 0.5 * (lo + hi);
          const fMid = foldResidual(m, band, mid, branch).value;
          if ((fMid > 0) === (fLo > 0)) {
            lo = mid;
            fLo = fMid;
          } else {
            hi = mid;
          }
        }
        points.push(foldPoint(m, theta, foldResidual(m, band, 0.5 * (lo + hi), branch)));
      }
      s0 = s1;
      f0 = f1;
    }
  }
  return points;
}

const near = (p, q, tol) => Math.hypot(p.x - q.x, p.y - q.y) < tol;

// Link the fold points of neighbouring angles into polylines in the control plane.
export function traceFoldSet(m, { steps = 1440, maxLength = 8, linkTol = 0.14 } = {}) {
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
        const d = Math.hypot(p.x - end.x, p.y - end.y);
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

  // Join the pieces that the seam at theta = pi cut in two.
  const chains = done.filter((chain) => chain.length > 1);
  for (let i = 0; i < chains.length; i += 1) {
    for (let j = 0; j < chains.length; j += 1) {
      if (i !== j && chains[i] && chains[j]
        && Math.abs(chains[i][chains[i].length - 1].theta - Math.PI) < (2 * TAU) / steps
        && Math.abs(chains[j][0].theta + Math.PI) < (2 * TAU) / steps
        && near(chains[i][chains[i].length - 1], chains[j][0], linkTol)) {
        chains[i] = chains[i].concat(chains[j]);
        chains[j] = null;
      }
    }
  }
  return chains.filter(Boolean).map((points) => ({
    points,
    closed: points.length > 2 && near(points[0], points[points.length - 1], linkTol),
  }));
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
    const theta = a.theta + 0.5 * gap;
    const guess = { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y) };
    const candidates = foldPointsAt(m, theta, maxLength);
    if (!candidates.length) break;
    let mid = candidates[0];
    for (const c of candidates) {
      if (Math.hypot(c.x - guess.x, c.y - guess.y) < Math.hypot(mid.x - guess.x, mid.y - guess.y)) mid = c;
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

// Cusps of the set: V''' changes sign along a chain of fold points.
export function findCusps(m, chains, maxLength = 8) {
  const cusps = [];
  for (const { points, closed } of chains) {
    const count = closed ? points.length : points.length - 1;
    for (let i = 0; i < count; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
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
