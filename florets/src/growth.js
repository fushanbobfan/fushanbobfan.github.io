// Growth at the tip of a shoot, after Douady and Couder (1996). New primordia
// appear one at a time on the rim of the apex, at the spot where the ones
// already there crowd them least, and every primordium drifts outward by a
// fixed factor per step. Nothing in the rule mentions an angle; the
// divergence between successive primordia is whatever the crowding produces.

export const TAU = 2 * Math.PI;

// Repulsion felt at angle theta on the apex rim (radius 1) from primordia at
// polar positions (r, a). The exponent sets how fast the inhibition fades.
export function crowding(theta, prims, power = 3) {
  const x = Math.cos(theta), y = Math.sin(theta);
  let e = 0;
  for (const p of prims) {
    const dx = x - p.r * Math.cos(p.a);
    const dy = y - p.r * Math.sin(p.a);
    e += 1 / Math.pow(dx * dx + dy * dy, power / 2);
  }
  return e;
}

// The least crowded spot on the rim: a coarse scan, then a golden-section
// search inside the best bracket.
export function leastCrowded(prims, power = 3, samples = 720) {
  if (!prims.length) return 0;
  let best = 0, bestE = Infinity;
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * TAU;
    const e = crowding(t, prims, power);
    if (e < bestE) { bestE = e; best = t; }
  }
  const h = TAU / samples;
  let lo = best - h, hi = best + h;
  const g = (Math.sqrt(5) - 1) / 2;
  let c = hi - g * (hi - lo), d = lo + g * (hi - lo);
  let fc = crowding(c, prims, power), fd = crowding(d, prims, power);
  for (let i = 0; i < 40; i++) {
    if (fc < fd) { hi = d; d = c; fd = fc; c = hi - g * (hi - lo); fc = crowding(c, prims, power); }
    else { lo = c; c = d; fc = fd; d = lo + g * (hi - lo); fd = crowding(d, prims, power); }
  }
  return wrap((lo + hi) / 2);
}

export function wrap(a) {
  return ((a % TAU) + TAU) % TAU;
}

// Signed turn from one primordium to the next, folded into [0, 180] degrees
// so a pattern and its mirror image read the same.
export function divergenceDeg(a, b) {
  let d = ((wrap(b - a) * 360) / TAU);
  if (d > 180) d = 360 - d;
  return d;
}

// Growth ratio for step i of a run that eases geometrically from start to end.
export function growthAt(i, steps, start, end = start) {
  if (steps <= 1 || start === end) return start;
  return start * Math.pow(end / start, Math.min(1, i / (steps - 1)));
}

// A tip that runs one step at a time. growth is the outward drift per step
// (r -> growth * r): a large value leaves only the newest primordium near the
// rim, a small one keeps many of them close. A young shoot has a narrow apex
// and drifts fast, so the default eases the ratio down from start to end.
export class Tip {
  constructor({ start = 3, end = 1.05, steps = 300, power = 3, keep = 80 } = {}) {
    Object.assign(this, { start, end, steps, power, keep });
    this.primordia = [{ r: start, a: 0, n: 0 }];
    this.divergences = [];
  }

  get done() {
    return this.divergences.length >= this.steps;
  }

  step() {
    const prims = this.primordia;
    const near = prims.length > this.keep ? prims.slice(-this.keep) : prims;
    const a = leastCrowded(near, this.power);
    this.divergences.push(divergenceDeg(prims[prims.length - 1].a, a));
    const g = growthAt(this.divergences.length - 1, this.steps, this.start, this.end);
    for (const p of prims) p.r *= g;
    prims.push({ r: 1, a, n: prims.length });
    return a;
  }

  run() {
    while (!this.done) this.step();
    return this;
  }
}

export function grow(options) {
  const tip = new Tip(options).run();
  return { primordia: tip.primordia, divergences: tip.divergences };
}

// Index steps to the two nearest primordia of primordium n that point in
// different directions, as for the florets of a head.
export function contactPairOf(prims, n, kMax = 120) {
  const p = prims[n];
  const px = p.r * Math.cos(p.a), py = p.r * Math.sin(p.a);
  const steps = [];
  for (let k = 1; k <= kMax; k++) {
    let d = Infinity;
    for (const m of [n - k, n + k]) {
      if (m < 0 || m >= prims.length) continue;
      const q = prims[m];
      d = Math.min(d, Math.hypot(px - q.r * Math.cos(q.a), py - q.r * Math.sin(q.a)));
    }
    if (Number.isFinite(d)) steps.push({ k, d });
  }
  steps.sort((s, t) => s.d - t.d);
  const k1 = steps[0].k;
  const k2 = (steps.find((s) => s.k % k1 !== 0) || { k: 2 * k1 }).k;
  return k1 < k2 ? [k1, k2] : [k2, k1];
}

// The angle the run settled on: the mean of the last few divergences, with
// their spread, so a run still wandering is easy to tell from a settled one.
export function settled(divergences, last = 30) {
  const tail = divergences.slice(-last);
  const mean = tail.reduce((s, d) => s + d, 0) / tail.length;
  const spread = Math.sqrt(tail.reduce((s, d) => s + (d - mean) ** 2, 0) / tail.length);
  return { mean, spread };
}
