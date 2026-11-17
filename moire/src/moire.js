import { phaseGradient, phases } from './gratings.js';

// Where two sheets overlap, their fine marks fall into and out of step. The
// broad bands that result are the moiré fringes. For two gratings with spatial
// frequencies fA and fB (cycles per pixel, pointing across the marks), the
// fringes are a grating of their own with frequency fA − fB.

// A line grating turned by 180° is the same grating, and a square lattice
// turned by 90° is the same lattice. Turn B by that symmetry until it is
// within half a step of A, so the slowest beat is the one we predict.
function symmetryStep(kind) {
  return kind === 'dots' ? Math.PI / 2 : Math.PI;
}

export function alignedTurns(a, b) {
  const step = symmetryStep(b.kind);
  return Math.round((b.angle - a.angle) / step);
}

function freq(angle, period) {
  return [Math.cos(angle) / period, Math.sin(angle) / period];
}

// The angle a set of stripes runs along, folded into [0°, 180°).
function stripeDegrees(fx, fy) {
  let deg = ((Math.atan2(fy, fx) + Math.PI / 2) * 180) / Math.PI;
  deg %= 180;
  if (deg < 0) deg += 180;
  return deg;
}

// Fringes of two line gratings.
//   period         distance between neighbouring fringes, in pixels
//   stripeAngle    direction the fringes run, in degrees
//   magnification  how far the fringes move when sheet B slides one pixel
//                  across its own lines
export function lineMoire(a, b) {
  const turns = alignedTurns(a, b);
  const fa = freq(a.angle, a.period);
  const fb = freq(b.angle - turns * Math.PI, b.period);
  const dx = fa[0] - fb[0];
  const dy = fa[1] - fb[1];
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-9) return { period: Infinity, stripeAngle: null, magnification: Infinity };
  const period = 1 / mag;
  return { period, stripeAngle: stripeDegrees(dx, dy), magnification: period / b.period };
}

// Two square lattices beat into a larger square-ish lattice. Returns its two
// cell edges as vectors in pixels, their lengths and the cell's turn.
export function latticeMoire(a, b) {
  const turns = alignedTurns(a, b);
  const bAngle = b.angle - (turns * Math.PI) / 2;
  const d1 = freq(a.angle, a.period).map((v, i) => v - freq(bAngle, b.period)[i]);
  const d2 = freq(a.angle + Math.PI / 2, a.period).map((v, i) => v - freq(bAngle + Math.PI / 2, b.period)[i]);
  const det = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(det) < 1e-12) return { edges: null, sides: [Infinity, Infinity], turnDegrees: null };
  // Real-space edges e1, e2 satisfy d_i · e_j = δ_ij.
  const e1 = [d2[1] / det, -d2[0] / det];
  const e2 = [-d1[1] / det, d1[0] / det];
  let turn = (Math.atan2(e1[1], e1[0]) * 180) / Math.PI;
  turn = ((turn % 90) + 90) % 90;
  return { edges: [e1, e2], sides: [Math.hypot(...e1), Math.hypot(...e2)], turnDegrees: turn };
}

function wholeNumbersBetween(lo, hi) {
  return Math.max(0, Math.floor(hi + 1e-9) - Math.ceil(lo - 1e-9) + 1);
}

// Two sets of rings. Along the line joining the centres the difference phase,
// measured from the middle of each sheet's marks as in fringePhase, runs from
// −d/pB to d/pA plus a shift set by the two ink widths; each whole number in
// that range is one fringe of the difference family crossing the line. With
// shared centres the fringes are rings again, spaced pA·pB / |pA − pB|.
export function ringMoire(a, b) {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  const shift = (b.duty - a.duty) / 2;
  const concentric = d < 1e-9;
  const spacing = a.period === b.period ? Infinity : (a.period * b.period) / Math.abs(a.period - b.period);
  return {
    distance: d,
    concentric,
    spacing: concentric ? spacing : null,
    crossings: concentric ? 0 : wholeNumbersBetween(shift - d / b.period, shift + d / a.period),
    equalSpacing: a.period === b.period,
  };
}

// The fringe phase at a point: integers mark the centres of the bright fringes,
// where the marks of the two sheets sit on top of each other and leave the
// most clear space. One number for lines and rings, two for dot lattices.
//
// Two sheets beat both at the difference of their phases and at the sum. For
// line gratings the slow one is fixed by their angles; for rings it changes
// from place to place (hyperbolas on either side, ellipses between the
// centres), so the slower of the two is taken at each point.
export function fringePhase(a, b, x, y) {
  if (a.kind === 'dots' && b.kind === 'dots') {
    const bb = { ...b, angle: b.angle - (alignedTurns(a, b) * Math.PI) / 2 };
    const pa = phases(a, x, y);
    const pb = phases(bb, x, y);
    return [pa[0] - pb[0], pa[1] - pb[1]];
  }
  if (a.kind === 'dots' || b.kind === 'dots') return null;
  // Measure each sheet from the middle of its marks.
  const ca = phases(a, x, y)[0] - a.duty / 2;
  const cb = phases(b, x, y)[0] - b.duty / 2;
  const ga = phaseGradient(a, x, y);
  const gb = phaseGradient(b, x, y);
  const diff = Math.hypot(ga[0] - gb[0], ga[1] - gb[1]);
  const sum = Math.hypot(ga[0] + gb[0], ga[1] + gb[1]);
  return [diff <= sum ? ca - cb : ca + cb];
}

// A mask (0..255 per device pixel) tracing the predicted bright-fringe centres:
// thin curves for lines and rings, small discs at the moiré lattice points for
// dots. Skipped wherever the beat is too fine to read as a fringe.
export function fringeMask(w, h, a, b, scale = 1, { lineWidth = 1.2, dotRadius = 3.5 } = {}) {
  const mask = new Uint8ClampedArray(w * h);
  if (!fringePhase(a, b, 0, 0)) return mask;
  const coarsest = Math.max(a.period, b.period);
  const eps = 0.5;
  for (let j = 0; j < h; j++) {
    const y = (j + 0.5) / scale;
    for (let i = 0; i < w; i++) {
      const x = (i + 0.5) / scale;
      const p = fringePhase(a, b, x, y);
      const px = fringePhase(a, b, x + eps, y);
      const py = fringePhase(a, b, x, y + eps);
      let dist2 = 0;
      let fine = false;
      for (let k = 0; k < p.length; k++) {
        const gx = (px[k] - p[k]) / eps;
        const gy = (py[k] - p[k]) / eps;
        const g = Math.hypot(gx, gy);
        // No beat at all (identical sheets), or one too fine to read.
        if (g < 1e-6 || g * coarsest * 2 > 1) fine = true;
        const off = (p[k] - Math.round(p[k])) / Math.max(g, 1e-9);
        dist2 += off * off;
      }
      if (fine) continue;
      const reach = p.length === 1 ? lineWidth : dotRadius;
      const dist = Math.sqrt(dist2);
      const alpha = Math.min(1, Math.max(0, (reach - dist) * scale + 0.5));
      mask[j * w + i] = alpha * 255;
    }
  }
  return mask;
}
