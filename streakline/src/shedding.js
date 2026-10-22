// Drag and lift histories and what can be read from them: the mean drag
// coefficient, the lift swing and the shedding frequency as a Strouhal
// number St = f D / U.

// Coefficients from a lattice force: C = F / (rho U^2 D / 2) with rho = 1.
// Lift is positive upwards on screen, which is negative lattice y.
export function coefficients(fx, fy, U, D) {
  const q = 0.5 * U * U * D;
  return { cd: fx / q, cl: -fy / q };
}

// Fixed-size history of (step, cd, cl) samples, oldest dropped first.
export function createHistory(capacity = 4000) {
  return {
    capacity,
    count: 0,
    start: 0,
    step: new Float64Array(capacity),
    cd: new Float32Array(capacity),
    cl: new Float32Array(capacity),
  };
}

export function record(h, step, cd, cl) {
  const k = (h.start + h.count) % h.capacity;
  h.step[k] = step;
  h.cd[k] = cd;
  h.cl[k] = cl;
  if (h.count < h.capacity) h.count++;
  else h.start = (h.start + 1) % h.capacity;
}

export function clearHistory(h) {
  h.count = 0;
  h.start = 0;
}

// Samples in time order as plain arrays, optionally only those at or after
// a given step.
export function samples(h, fromStep = -Infinity) {
  const step = [], cd = [], cl = [];
  for (let j = 0; j < h.count; j++) {
    const k = (h.start + j) % h.capacity;
    if (h.step[k] < fromStep) continue;
    step.push(h.step[k]);
    cd.push(h.cd[k]);
    cl.push(h.cl[k]);
  }
  return { step, cd, cl };
}

// Times where a signal crosses its mean going upwards, placed between the
// two samples by linear interpolation.
export function upCrossings(t, y) {
  if (y.length < 2) return [];
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const out = [];
  for (let k = 1; k < y.length; k++) {
    const a = y[k - 1] - mean, b = y[k] - mean;
    if (a < 0 && b >= 0) out.push(t[k - 1] + ((t[k] - t[k - 1]) * -a) / (b - a));
  }
  return out;
}

// Read the shedding off the lift history: the period from the up-crossings,
// and drag and lift averaged over whole periods only. Needs at least three
// crossings and a lift swing above `minSwing`, else the wake counts as
// steady and only the mean drag is reported.
export function analyse(h, U, D, { fromStep = -Infinity, minSwing = 0.02 } = {}) {
  const { step, cd, cl } = samples(h, fromStep);
  if (step.length < 4) return null;
  const meanOf = (arr, lo, hi) => {
    let s = 0, k = 0;
    for (let j = 0; j < step.length; j++) {
      if (step[j] < lo || step[j] > hi) continue;
      s += arr[j];
      k++;
    }
    return k ? s / k : NaN;
  };
  const swingOf = (lo, hi) => {
    let mn = Infinity, mx = -Infinity;
    for (let j = 0; j < step.length; j++) {
      if (step[j] < lo || step[j] > hi) continue;
      mn = Math.min(mn, cl[j]);
      mx = Math.max(mx, cl[j]);
    }
    return mx - mn;
  };
  const ups = upCrossings(step, cl);
  const first = step[0], last = step[step.length - 1];
  if (ups.length >= 3 && swingOf(first, last) > minSwing) {
    const lo = ups[0], hi = ups[ups.length - 1];
    const period = (hi - lo) / (ups.length - 1);
    return {
      shedding: true,
      period,
      strouhal: D / (period * U),
      cd: meanOf(cd, lo, hi),
      clMean: meanOf(cl, lo, hi),
      clAmplitude: swingOf(lo, hi) / 2,
      cycles: ups.length - 1,
    };
  }
  return {
    shedding: false,
    period: NaN,
    strouhal: NaN,
    cd: meanOf(cd, first, last),
    clMean: meanOf(cl, first, last),
    clAmplitude: swingOf(first, last) / 2,
    cycles: 0,
  };
}
