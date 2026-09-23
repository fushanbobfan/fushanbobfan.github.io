import { normalizeDesign } from './harmonograph.js';

// Frequency ratios between the horizontal and vertical motion. The figure a
// harmonograph draws is governed by how close that ratio is to a simple
// fraction p:q and by how far it is detuned from it.

// Best rational approximation p/q of x with q ≤ maxDen, from the continued
// fraction convergents and the best semiconvergent at the cut-off.
export function nearestFraction(x, maxDen = 12) {
  if (!Number.isFinite(x) || x <= 0) return null;
  let [p0, q0, p1, q1] = [0, 1, 1, 0];
  let value = x;
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(value);
    const p2 = a * p1 + p0;
    const q2 = a * q1 + q0;
    if (q2 > maxDen) {
      // Largest k keeping the semiconvergent's denominator in range.
      const k = Math.floor((maxDen - q0) / q1);
      const semi = { p: k * p1 + p0, q: k * q1 + q0 };
      const conv = { p: p1, q: q1 };
      const err = (f) => Math.abs(f.p / f.q - x);
      return k > 0 && err(semi) < err(conv) ? semi : conv;
    }
    [p0, q0, p1, q1] = [p1, q1, p2, q2];
    const frac = value - a;
    if (frac < 1e-12) break;
    value = 1 / frac;
  }
  return { p: p1, q: q1 };
}

// The frequency that dominates an axis: the swing with the largest amplitude.
export function dominantFrequency(design, axis) {
  let best = null;
  for (const p of design.pendulums) {
    const moves = p.axis === axis || p.axis === 'rotary';
    if (moves && p.amp > 0 && (!best || p.amp > best.amp)) best = p;
  }
  return best ? best.freq : null;
}

// Describe the x:y ratio: the nearest simple fraction and the detune from it.
export function axisRatio(design, maxDen = 12) {
  const fx = dominantFrequency(design, 'x');
  const fy = dominantFrequency(design, 'y');
  if (fx === null || fy === null) return null;
  const ratio = fx / fy;
  const frac = nearestFraction(ratio, maxDen);
  const exact = frac.p / frac.q;
  return { fx, fy, ratio, p: frac.p, q: frac.q, detune: ratio / exact - 1 };
}

export function formatRatio(info) {
  if (!info) return 'Needs both a horizontal and a vertical swing.';
  const pct = info.detune * 100;
  const sign = pct >= 0 ? '+' : '−';
  const off = Math.abs(pct) < 0.005 ? 'exact' : `${sign}${Math.abs(pct).toFixed(2)}%`;
  return `x : y ≈ ${info.p}:${info.q} (${off})`;
}

// Retune the dominant horizontal swing so x:y equals p:q times (1 + detune).
// Returns a new design; the vertical motion is left untouched.
export function retuneToRatio(design, p, q, detune = 0) {
  const fy = dominantFrequency(design, 'y');
  const fx = dominantFrequency(design, 'x');
  if (fy === null || fx === null || !(p > 0) || !(q > 0)) return design;
  const target = fy * (p / q) * (1 + detune);
  let done = false;
  const pendulums = design.pendulums.map((pend) => {
    // Rotary swings drive both axes, so only a pure horizontal one is moved.
    if (done || pend.axis !== 'x' || pend.freq !== fx) return pend;
    done = true;
    return { ...pend, freq: target };
  });
  return done ? normalizeDesign({ pendulums }) : design;
}
