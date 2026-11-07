// The voltage clamp: the experiment the equations came from. With the voltage
// held fixed each gate relaxes exponentially, so the currents have an exact
// solution and no integrator is needed.

import { alphaH, alphaM, alphaN, betaH, betaM, betaN, steadyGates, temperatureFactor } from './hh.js';

function relax(alpha, beta, start, t, phi) {
  const rate = phi * (alpha + beta);
  const target = alpha / (alpha + beta);
  return target + (start - target) * Math.exp(-rate * t);
}

// Currents at time t after stepping from a holding voltage to a clamp voltage.
export function clampCurrents(p, hold, v, t, celsius = 6.3) {
  const phi = temperatureFactor(celsius);
  const start = steadyGates(hold);
  const m = relax(alphaM(v), betaM(v), start.m, t, phi);
  const h = relax(alphaH(v), betaH(v), start.h, t, phi);
  const n = relax(alphaN(v), betaN(v), start.n, t, phi);
  const gNa = p.gNa * m * m * m * h;
  const gK = p.gK * n * n * n * n;
  const iNa = gNa * (v - p.eNa);
  const iK = gK * (v - p.eK);
  const iL = p.gL * (v - p.eL);
  return { m, h, n, gNa, gK, iNa, iK, iL, total: iNa + iK + iL };
}

export function clampTrace(p, hold, v, { duration = 20, samples = 400, celsius = 6.3 } = {}) {
  const size = samples + 1;
  const trace = {
    t: new Float64Array(size),
    iNa: new Float64Array(size),
    iK: new Float64Array(size),
    total: new Float64Array(size),
  };
  for (let i = 0; i < size; i++) {
    const t = (i / samples) * duration;
    const c = clampCurrents(p, hold, v, t, celsius);
    trace.t[i] = t;
    trace.iNa[i] = c.iNa;
    trace.iK[i] = c.iK;
    trace.total[i] = c.total;
  }
  return trace;
}

// The two numbers read off each step in a current-voltage plot: the largest
// early inward current, and the current left late in the step.
export function currentVoltage(p, hold, voltages, { duration = 40, samples = 800, celsius = 6.3 } = {}) {
  return voltages.map((v) => {
    const trace = clampTrace(p, hold, v, { duration, samples, celsius });
    let early = 0;
    for (let i = 0; i < trace.total.length; i++) {
      if (Math.abs(trace.iNa[i]) > Math.abs(early)) early = trace.iNa[i];
    }
    return { v, early, late: trace.total[trace.total.length - 1] };
  });
}
