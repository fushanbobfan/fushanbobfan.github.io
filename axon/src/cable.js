// An axon as a chain of membrane patches joined by the resistance of the
// axoplasm. Voltage spreads through a tridiagonal solve, so the time step need
// not shrink with the patch size; the gates step exactly, half a step out of
// phase with the voltage. This staggered scheme is second-order in time.

import {
  SQUID, alphaH, alphaM, alphaN, betaH, betaM, betaN, steadyGates, temperatureFactor,
} from './hh.js';

export const AXOPLASM_RESISTIVITY = 35.4; // ohm cm
const REST = -65;

// Myelin wraps the axon between nodes, cutting its capacitance and leak by the
// number of wraps. A thicker fibre has a proportionally thicker sheath.
export function sheathFactor(diameter) {
  return Math.max(2, 10 * diameter);
}

// Options: diameter in micrometres, count of patches, spacing dx in cm, celsius,
// and nodeEvery, which places a node at every nth patch and myelin in between.
export function makeCable({ diameter, count, dx, celsius = 18.5, nodeEvery = 0, nodeDensity = 1 }) {
  const g = steadyGates(REST);
  const cable = {
    diameter,
    count,
    dx,
    celsius,
    nodeEvery,
    nodeDensity,
    phi: temperatureFactor(celsius),
    // Conductance per unit membrane area to each neighbour, in mS/cm2.
    coupling: (1000 * (diameter * 1e-4) / 2 / (2 * AXOPLASM_RESISTIVITY)) / (dx * dx),
    time: 0,
    v: new Float64Array(count).fill(REST),
    m: new Float64Array(count).fill(g.m),
    h: new Float64Array(count).fill(g.h),
    n: new Float64Array(count).fill(g.n),
    cm: new Float64Array(count),
    gNa: new Float64Array(count),
    gK: new Float64Array(count),
    gL: new Float64Array(count),
    eL: new Float64Array(count),
    pulses: [],
    diagonal: new Float64Array(count),
    upper: new Float64Array(count),
    right: new Float64Array(count),
  };
  for (let i = 0; i < count; i++) setPatch(cable, i, isSheathed(cable, i));
  return cable;
}

export function isNode(cable, i) {
  return cable.nodeEvery > 0 && i % cable.nodeEvery === 0;
}

function isSheathed(cable, i) {
  return cable.nodeEvery > 0 && !isNode(cable, i);
}

// A sheathed patch has no working channels. A bare patch carries the squid
// channels, multiplied at nodes, where they crowd together.
function setPatch(cable, i, sheathed) {
  const density = isNode(cable, i) ? cable.nodeDensity : 1;
  const wraps = sheathFactor(cable.diameter);
  cable.cm[i] = sheathed ? SQUID.cm / wraps : SQUID.cm;
  cable.gNa[i] = sheathed ? 0 : SQUID.gNa * density;
  cable.gK[i] = sheathed ? 0 : SQUID.gK * density;
  // Every patch's leak balances its channels at rest, so the chain starts still.
  const gL = sheathed ? SQUID.gL / wraps : SQUID.gL * density;
  cable.gL[i] = gL;
  const g = steadyGates(REST);
  const iChannels = sheathed ? 0
    : cable.gNa[i] * g.m * g.m * g.m * g.h * (REST - SQUID.eNa) + cable.gK[i] * g.n ** 4 * (REST - SQUID.eK);
  cable.eL[i] = REST + iChannels / gL;
}

// Strips the sheath from the internode that holds this patch. The bare stretch
// has neither the low capacitance of myelin nor channels of its own.
export function stripInternode(cable, i) {
  if (!cable.nodeEvery) return null;
  const first = i - (i % cable.nodeEvery);
  for (let k = first + 1; k < Math.min(first + cable.nodeEvery, cable.count); k++) {
    cable.cm[k] = SQUID.cm;
    cable.gL[k] = SQUID.gL;
    cable.eL[k] = REST;
  }
  return first;
}

export function firePulse(cable, centre, { amplitude = 400, duration = 0.5, width = 2 } = {}) {
  cable.pulses.push({
    from: Math.max(0, centre - width),
    to: Math.min(cable.count - 1, centre + width),
    start: cable.time,
    end: cable.time + duration,
    amplitude,
  });
}

function relaxGates(cable, dt) {
  const { v, m, h, n, phi, count } = cable;
  for (let i = 0; i < count; i++) {
    if (cable.gNa[i] === 0) continue;
    const u = v[i];
    const am = alphaM(u);
    const bm = betaM(u);
    const ah = alphaH(u);
    const bh = betaH(u);
    const an = alphaN(u);
    const bn = betaN(u);
    const sm = am + bm;
    const sh = ah + bh;
    const sn = an + bn;
    m[i] = am / sm + (m[i] - am / sm) * Math.exp(-phi * sm * dt);
    h[i] = ah / sh + (h[i] - ah / sh) * Math.exp(-phi * sh * dt);
    n[i] = an / sn + (n[i] - an / sn) * Math.exp(-phi * sn * dt);
  }
}

// One step: gates first, then the voltage by a half step of backward Euler that
// is extrapolated to the full step (Crank-Nicolson).
export function advance(cable, dt) {
  relaxGates(cable, dt);
  const {
    v, m, h, n, cm, gNa, gK, gL, eL, coupling, count, diagonal, upper, right,
  } = cable;
  const half = dt / 2;
  cable.pulses = cable.pulses.filter((p) => p.end > cable.time);
  for (let i = 0; i < count; i++) {
    const conductNa = gNa[i] * m[i] * m[i] * m[i] * h[i];
    const n2 = n[i] * n[i];
    const conductK = gK[i] * n2 * n2;
    const links = (i > 0 ? 1 : 0) + (i < count - 1 ? 1 : 0);
    diagonal[i] = cm[i] / half + conductNa + conductK + gL[i] + links * coupling;
    right[i] = (cm[i] / half) * v[i] + conductNa * SQUID.eNa + conductK * SQUID.eK + gL[i] * eL[i];
  }
  for (const p of cable.pulses) {
    if (cable.time + half >= p.start && cable.time + half < p.end) {
      for (let i = p.from; i <= p.to; i++) right[i] += p.amplitude;
    }
  }
  // Thomas algorithm: every off-diagonal entry is -coupling.
  upper[0] = -coupling / diagonal[0];
  right[0] /= diagonal[0];
  for (let i = 1; i < count; i++) {
    const denominator = diagonal[i] + coupling * upper[i - 1];
    upper[i] = -coupling / denominator;
    right[i] = (right[i] + coupling * right[i - 1]) / denominator;
  }
  let solved = right[count - 1];
  v[count - 1] = 2 * solved - v[count - 1];
  for (let i = count - 2; i >= 0; i--) {
    solved = right[i] - upper[i] * solved;
    v[i] = 2 * solved - v[i];
  }
  cable.time += dt;
}

// Spikes on thin or warm fibres can stay below 0 mV while still travelling at a
// steady height, so arrival is timed at a lower level.
export const ARRIVAL_LEVEL = -20;

// Fires near one end and times the arrival at two patches, in m/s.
export function measureSpeed(options, { dt = 0.01, from = null, to = null, maxTime = 80, stripped = [] } = {}) {
  const cable = makeCable(options);
  for (const i of stripped) stripInternode(cable, i);
  const a = from ?? Math.round(cable.count * 0.3);
  const b = to ?? Math.round(cable.count * 0.7);
  const start = Math.round(cable.count * 0.05);
  firePulse(cable, cable.nodeEvery ? Math.round(start / cable.nodeEvery) * cable.nodeEvery : start);
  let timeA = null;
  let timeB = null;
  while (cable.time < maxTime && timeB === null) {
    const beforeA = cable.v[a];
    const beforeB = cable.v[b];
    advance(cable, dt);
    if (timeA === null && beforeA < ARRIVAL_LEVEL && cable.v[a] >= ARRIVAL_LEVEL) {
      timeA = cable.time - dt + (dt * (ARRIVAL_LEVEL - beforeA)) / (cable.v[a] - beforeA);
    }
    if (timeB === null && beforeB < ARRIVAL_LEVEL && cable.v[b] >= ARRIVAL_LEVEL) {
      timeB = cable.time - dt + (dt * (ARRIVAL_LEVEL - beforeB)) / (cable.v[b] - beforeB);
    }
  }
  if (timeA === null || timeB === null) return null;
  return (((b - a) * options.dx) / (timeB - timeA)) * 10;
}

// The same stretch of fibre as a bare axon and as a sheathed one. Patches are
// spaced to the fibre's length constant when bare and to its internodes when
// sheathed, which are taken as 100 diameters long, with 10 patches each and a
// node channel density of 2. The stretch is long enough to show a whole spike
// on the bare axon and at least 20 internodes on the sheathed one.
export const INTERNODE_PATCHES = 10;
export const NODE_DENSITY = 2;

export function fibre(diameter, celsius = 18.5) {
  const length = Math.max(0.2 * diameter, 12 * Math.sqrt(diameter / 476));
  const bareDx = 0.05 * Math.sqrt(diameter / 476);
  const sheathDx = (100 * diameter * 1e-4) / INTERNODE_PATCHES;
  return {
    length,
    bare: { diameter, celsius, dx: length / Math.round(length / bareDx), count: Math.round(length / bareDx) + 1 },
    sheathed: {
      diameter,
      celsius,
      dx: sheathDx,
      count: Math.round(length / sheathDx / INTERNODE_PATCHES) * INTERNODE_PATCHES + 1,
      nodeEvery: INTERNODE_PATCHES,
      nodeDensity: NODE_DENSITY,
    },
  };
}

export function stepFor(celsius) {
  return Math.min(0.01, 0.04 / temperatureFactor(celsius));
}
