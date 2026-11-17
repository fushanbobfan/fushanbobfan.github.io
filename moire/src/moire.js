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

// Bars are a square wave, not a pure stripe: besides its own spacing p, a
// sheet carries fainter stripes at p/2, p/3 and so on. The m-th has amplitude
// 2·sin(π·m·duty)/(π·m), measured from the middle of the bars, so with half
// the period inked the even ones vanish. Any harmonic of one sheet can beat
// with any harmonic of the other: m·fA − n·fB. The beat's contrast is half the
// product of the two amplitudes, and its sign says whether the bright fringes
// sit where the phase m·cA − n·cB is whole or half way between.
export function harmonicAmplitude(m, duty) {
  return (2 * Math.sin(Math.PI * m * duty)) / (Math.PI * m);
}

function gcd(x, y) {
  return y === 0 ? Math.abs(x) : gcd(y, x % y);
}

export const MAX_ORDER = 4;

// Every beat of two bar sheets up to MAX_ORDER, slowest first. A pair with a
// common factor is a harmonic of a slower beat and is left out.
export function lineBeats(a, b, maxOrder = MAX_ORDER) {
  const beats = [];
  for (let m = 1; m <= maxOrder; m++) {
    for (let n = -maxOrder; n <= maxOrder; n++) {
      if (n === 0 || gcd(m, n) !== 1) continue;
      const fx = (m * Math.cos(a.angle)) / a.period - (n * Math.cos(b.angle)) / b.period;
      const fy = (m * Math.sin(a.angle)) / a.period - (n * Math.sin(b.angle)) / b.period;
      const mag = Math.hypot(fx, fy);
      const contrast = (harmonicAmplitude(m, a.duty) * harmonicAmplitude(Math.abs(n), b.duty)) / 2;
      beats.push({
        m,
        n,
        period: mag < 1e-9 ? Infinity : 1 / mag,
        stripeAngle: mag < 1e-9 ? null : stripeDegrees(fx, fy),
        contrast: Math.abs(contrast),
        flipped: contrast < 0,
        magnification: mag < 1e-9 ? Infinity : Math.abs(n) / mag / b.period,
      });
    }
  }
  return beats.sort((p, q) => q.period - p.period);
}

// The beat that shows as broad fringes: the highest-contrast one at least
// twice as wide as the coarser sheet's bars. Null when none is.
export function visibleBeat(a, b, maxOrder = MAX_ORDER) {
  const coarsest = Math.max(a.period, b.period);
  let best = null;
  for (const beat of lineBeats(a, b, maxOrder)) {
    if (beat.period === Infinity || beat.period < 2 * coarsest || beat.contrast < 1e-3) continue;
    if (!best || beat.contrast > best.contrast) best = beat;
  }
  return best;
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
// bars the visible beat is fixed by the two sheets, harmonics included (pass
// it as `beat` to skip the search); for rings it changes from place to place
// (hyperbolas on either side, ellipses between the centres), so the slower of
// the two is taken at each point.
export function fringePhase(a, b, x, y, beat) {
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
  if (a.kind === 'lines' && b.kind === 'lines') {
    const chosen = beat === undefined ? visibleBeat(a, b) : beat;
    if (chosen) return [chosen.m * ca - chosen.n * cb + (chosen.flipped ? 0.5 : 0)];
    // Nothing broad: fall back to the main beat, which the mask will skip.
    return [alignedTurns(a, b) % 2 === 0 ? ca - cb : ca + cb];
  }
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
  const beat = a.kind === 'lines' && b.kind === 'lines' ? visibleBeat(a, b) : undefined;
  const coarsest = Math.max(a.period, b.period);
  const eps = 0.5;
  for (let j = 0; j < h; j++) {
    const y = (j + 0.5) / scale;
    for (let i = 0; i < w; i++) {
      const x = (i + 0.5) / scale;
      const p = fringePhase(a, b, x, y, beat);
      const px = fringePhase(a, b, x + eps, y, beat);
      const py = fringePhase(a, b, x, y + eps, beat);
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
