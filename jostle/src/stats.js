// Measurements on the gas and the kinetic-theory curves they are checked
// against. In two dimensions the equilibrium speed distribution for disks of
// mass m at temperature kT is
//   f(v) = (m v / kT) exp(-m v^2 / 2kT),   F(v) = 1 - exp(-m v^2 / 2kT).

export function maxwellPdf(v, m, kT) {
  if (v < 0) return 0;
  return ((m * v) / kT) * Math.exp((-m * v * v) / (2 * kT));
}

export function maxwellCdf(v, m, kT) {
  if (v <= 0) return 0;
  return 1 - Math.exp((-m * v * v) / (2 * kT));
}

export function characteristicSpeeds(m, kT) {
  return {
    mostProbable: Math.sqrt(kT / m),
    mean: Math.sqrt((Math.PI * kT) / (2 * m)),
    rms: Math.sqrt((2 * kT) / m),
  };
}

// Count speeds into `bins` equal bins on [0, vmax); speeds beyond the top go
// into the last bin. `select(i)` picks which disks count.
export function speedHistogram(gas, bins, vmax, select = null) {
  const counts = new Float64Array(bins);
  let total = 0;
  const w = vmax / bins;
  for (let i = 0; i < gas.n; i++) {
    if (select && !select(i)) continue;
    const v = Math.hypot(gas.vx[i], gas.vy[i]);
    const k = Math.min(bins - 1, Math.floor(v / w));
    counts[k]++;
    total++;
  }
  return { counts, total, width: w, vmax };
}

// Add a histogram into a running average so the chart is less noisy than a
// single snapshot. `keep` in (0, 1] weights the history.
export function blendHistogram(avg, hist, keep = 0.9) {
  if (!avg || avg.counts.length !== hist.counts.length || avg.vmax !== hist.vmax) {
    return { counts: Float64Array.from(hist.counts), total: hist.total, width: hist.width, vmax: hist.vmax };
  }
  for (let k = 0; k < avg.counts.length; k++) {
    avg.counts[k] = keep * avg.counts[k] + (1 - keep) * hist.counts[k];
  }
  avg.total = keep * avg.total + (1 - keep) * hist.total;
  return avg;
}

// Boltzmann's H on the binned velocity distribution: H = sum p ln(p / dv).
// It falls as the gas relaxes and levels off at the Maxwell value.
export function boltzmannH(hist) {
  if (hist.total === 0) return 0;
  let h = 0;
  for (let k = 0; k < hist.counts.length; k++) {
    const p = hist.counts[k] / hist.total;
    if (p > 0) h += p * Math.log(p / hist.width);
  }
  return h;
}

// H for the exact Maxwell distribution binned the same way, the floor the
// measured H approaches.
export function maxwellH(m, kT, bins, vmax) {
  const w = vmax / bins;
  let h = 0;
  let prev = 0;
  for (let k = 0; k < bins; k++) {
    const next = k === bins - 1 ? 1 : maxwellCdf((k + 1) * w, m, kT);
    const p = next - prev;
    prev = next;
    if (p > 0) h += p * Math.log(p / w);
  }
  return h;
}

// Largest gap between the empirical speed CDF and the Maxwell CDF
// (the Kolmogorov-Smirnov statistic).
export function ksDistance(gas, m, kT, select = null) {
  const v = [];
  for (let i = 0; i < gas.n; i++) {
    if (select && !select(i)) continue;
    v.push(Math.hypot(gas.vx[i], gas.vy[i]));
  }
  v.sort((a, b) => a - b);
  let d = 0;
  for (let k = 0; k < v.length; k++) {
    const F = maxwellCdf(v[k], m, kT);
    d = Math.max(d, Math.abs((k + 1) / v.length - F), Math.abs(F - k / v.length));
  }
  return d;
}

// Pressure on the walls of an area A box: momentum delivered per unit
// perimeter per unit time.
export function wallPressure(impulse, elapsed, width, height) {
  if (elapsed <= 0) return 0;
  return impulse / (2 * (width + height) * elapsed);
}

export function idealPressure(n, kT, width, height) {
  return (n * kT) / (width * height);
}

// Henderson's equation of state for hard disks at packing fraction eta:
// Z = PA / NkT = (1 + eta^2 / 8) / (1 - eta)^2.
export function hendersonZ(eta) {
  return (1 + (eta * eta) / 8) / (1 - eta) ** 2;
}

// A sliding record of wall impulse so pressure is read over recent time.
export function createPressureMeter(window = 50) {
  return { window, samples: [] };
}

export function recordPressure(meter, impulse, dt) {
  meter.samples.push([impulse, dt]);
  let t = 0;
  for (const s of meter.samples) t += s[1];
  while (meter.samples.length > 1 && t - meter.samples[0][1] >= meter.window) {
    t -= meter.samples.shift()[1];
  }
}

export function meterReading(meter, width, height) {
  let imp = 0;
  let t = 0;
  for (const [i, d] of meter.samples) { imp += i; t += d; }
  return wallPressure(imp, t, width, height);
}

// A history that keeps its whole span in at most `cap` points: when full it
// drops every other point and from then on records every other sample, so
// the early fall of H stays on the chart however long the run.
export function createHistory(cap = 360) {
  return { cap, values: [], stride: 1, skipped: 0 };
}

export function pushHistory(history, value) {
  if (history.skipped + 1 < history.stride) {
    history.skipped++;
    return;
  }
  history.skipped = 0;
  history.values.push(value);
  if (history.values.length > history.cap) {
    history.values = history.values.filter((_, k) => k % 2 === 0);
    history.stride *= 2;
  }
}
