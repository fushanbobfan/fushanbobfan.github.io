// The Hodgkin-Huxley equations for a patch of squid axon membrane, in the
// modern sign convention: voltage in mV with rest near -65, time in ms,
// conductance in mS/cm2, current in uA/cm2, capacitance in uF/cm2.

export const SQUID = Object.freeze({
  cm: 1,
  gNa: 120,
  gK: 36,
  gL: 0.3,
  eNa: 50,
  eK: -77,
  eL: -54.387,
  temperature: 6.3,
});

const REFERENCE_TEMPERATURE = 6.3;
const Q10 = 3;

// Rates speed up threefold for every 10 degrees; the equilibria stay put.
export function temperatureFactor(celsius) {
  return Math.pow(Q10, (celsius - REFERENCE_TEMPERATURE) / 10);
}

// x / (exp(x / y) - 1), which is 0/0 at x = 0 and tends to y there.
function vtrap(x, y) {
  const r = x / y;
  if (Math.abs(r) < 1e-6) return y * (1 - r / 2);
  return x / (Math.exp(r) - 1);
}

export const alphaN = (v) => 0.01 * vtrap(-(v + 55), 10);
export const betaN = (v) => 0.125 * Math.exp(-(v + 65) / 80);
export const alphaM = (v) => 0.1 * vtrap(-(v + 40), 10);
export const betaM = (v) => 4 * Math.exp(-(v + 65) / 18);
export const alphaH = (v) => 0.07 * Math.exp(-(v + 65) / 20);
export const betaH = (v) => 1 / (1 + Math.exp(-(v + 35) / 10));

export function steadyGates(v) {
  const an = alphaN(v);
  const am = alphaM(v);
  const ah = alphaH(v);
  return {
    m: am / (am + betaM(v)),
    h: ah / (ah + betaH(v)),
    n: an / (an + betaN(v)),
  };
}

// Conductances and currents for a state { v, m, h, n }.
export function channels(p, s) {
  const gNa = p.gNa * s.m * s.m * s.m * s.h;
  const gK = p.gK * s.n * s.n * s.n * s.n;
  return {
    gNa,
    gK,
    iNa: gNa * (s.v - p.eNa),
    iK: gK * (s.v - p.eK),
    iL: p.gL * (s.v - p.eL),
  };
}

// Writes the time derivatives of y = [v, m, h, n] into out.
export function derivatives(p, phi, y, stim, out) {
  const v = y[0];
  const m = y[1];
  const h = y[2];
  const n = y[3];
  const gNa = p.gNa * m * m * m * h;
  const n2 = n * n;
  const gK = p.gK * n2 * n2;
  out[0] = (stim - gNa * (v - p.eNa) - gK * (v - p.eK) - p.gL * (v - p.eL)) / p.cm;
  out[1] = phi * (alphaM(v) * (1 - m) - betaM(v) * m);
  out[2] = phi * (alphaH(v) * (1 - h) - betaH(v) * h);
  out[3] = phi * (alphaN(v) * (1 - n) - betaN(v) * n);
}

// One classical Runge-Kutta step, in place. stimOf(t) gives the injected current.
const k1 = new Float64Array(4);
const k2 = new Float64Array(4);
const k3 = new Float64Array(4);
const k4 = new Float64Array(4);
const mid = new Float64Array(4);

export function step(p, phi, y, t, dt, stimOf) {
  const half = dt / 2;
  derivatives(p, phi, y, stimOf(t), k1);
  for (let i = 0; i < 4; i++) mid[i] = y[i] + half * k1[i];
  const stimMid = stimOf(t + half);
  derivatives(p, phi, mid, stimMid, k2);
  for (let i = 0; i < 4; i++) mid[i] = y[i] + half * k2[i];
  derivatives(p, phi, mid, stimMid, k3);
  for (let i = 0; i < 4; i++) mid[i] = y[i] + dt * k3[i];
  derivatives(p, phi, mid, stimOf(t + dt), k4);
  for (let i = 0; i < 4; i++) y[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

// A step small enough for the fastest rate at this temperature.
export function stableStep(celsius) {
  return 0.01 / Math.max(1, temperatureFactor(celsius) / 3);
}
