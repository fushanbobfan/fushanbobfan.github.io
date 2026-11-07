// Runs a patch of membrane through a stimulus and records what happened.

import { SQUID, channels, stableStep, steadyGates, step, temperatureFactor } from './hh.js';

// The membrane's parameters once a share of each channel type is blocked.
export function membrane({ naOpen = 1, kOpen = 1 } = {}) {
  return { ...SQUID, gNa: SQUID.gNa * naOpen, gK: SQUID.gK * kOpen };
}

// A stimulus is a list of pulses { start, duration, amplitude }, which add up.
export function stimulusAt(pulses, t) {
  let total = 0;
  for (const p of pulses) {
    if (t >= p.start && t < p.start + p.duration) total += p.amplitude;
  }
  return total;
}

// Where an unstimulated membrane comes to rest. A membrane with channels
// blocked can settle somewhere else, so it runs for a while to find out.
export function restingState(p, celsius = SQUID.temperature) {
  const g = steadyGates(-65);
  const y = new Float64Array([-65, g.m, g.h, g.n]);
  const phi = temperatureFactor(celsius);
  const dt = stableStep(celsius) * 2;
  const none = () => 0;
  const steps = Math.ceil(400 / dt);
  for (let i = 0; i < steps; i++) step(p, phi, y, i * dt, dt, none);
  return y;
}

const restCache = new Map();

function cachedRest(p, celsius) {
  const key = `${p.gNa}|${p.gK}|${celsius}`;
  if (!restCache.has(key)) {
    if (restCache.size > 200) restCache.clear();
    restCache.set(key, restingState(p, celsius));
  }
  return restCache.get(key);
}

// Whether an untouched membrane holds still, and at what voltage.
export function restBehaviour(p, celsius = SQUID.temperature) {
  const trace = simulate(p, [], { duration: 60, samples: 300, celsius });
  let low = Infinity;
  let high = -Infinity;
  for (const value of trace.v) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return { settled: high - low < 0.5, v: trace.v[trace.v.length - 1] };
}

// Options: duration in ms, samples between 0 and duration, celsius, and an
// optional start state, which skips the search for rest.
export function simulate(p, pulses, { duration = 50, samples = 1000, celsius = SQUID.temperature, start } = {}) {
  const y = Float64Array.from(start ?? cachedRest(p, celsius));
  const phi = temperatureFactor(celsius);
  const size = samples + 1;
  const trace = {
    duration,
    t: new Float64Array(size),
    v: new Float64Array(size),
    m: new Float64Array(size),
    h: new Float64Array(size),
    n: new Float64Array(size),
    gNa: new Float64Array(size),
    gK: new Float64Array(size),
    iNa: new Float64Array(size),
    iK: new Float64Array(size),
    iL: new Float64Array(size),
    stim: new Float64Array(size),
  };
  const record = (i, t) => {
    const s = { v: y[0], m: y[1], h: y[2], n: y[3] };
    const c = channels(p, s);
    trace.t[i] = t;
    trace.v[i] = s.v;
    trace.m[i] = s.m;
    trace.h[i] = s.h;
    trace.n[i] = s.n;
    trace.gNa[i] = c.gNa;
    trace.gK[i] = c.gK;
    trace.iNa[i] = c.iNa;
    trace.iK[i] = c.iK;
    trace.iL[i] = c.iL;
    trace.stim[i] = stimulusAt(pulses, t);
  };
  const stimOf = (t) => stimulusAt(pulses, t);
  const interval = duration / samples;
  const inner = Math.max(1, Math.ceil(interval / stableStep(celsius)));
  const dt = interval / inner;
  record(0, 0);
  for (let i = 1; i < size; i++) {
    const from = (i - 1) * interval;
    for (let j = 0; j < inner; j++) step(p, phi, y, from + j * dt, dt, stimOf);
    record(i, i * interval);
  }
  return trace;
}

// A spike is an upward crossing of a level, 0 mV unless told otherwise, with
// the crossing time found by interpolating between samples.
export function spikeTimes(trace, level = 0) {
  const { t, v } = trace;
  const times = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i - 1] < level && v[i] >= level) {
      times.push(t[i - 1] + ((level - v[i - 1]) / (v[i] - v[i - 1])) * (t[i] - t[i - 1]));
    }
  }
  return times;
}

// Width of the spike at 0 mV: from its crossing upward to the next downward.
function spikeWidth(trace, from) {
  const { t, v } = trace;
  let i = 1;
  while (i < v.length && t[i] <= from) i++;
  for (; i < v.length; i++) {
    if (v[i - 1] >= 0 && v[i] < 0) {
      const down = t[i - 1] + (v[i - 1] / (v[i - 1] - v[i])) * (t[i] - t[i - 1]);
      return down - from;
    }
  }
  return null;
}

// What the readouts show under a trace.
export function summarize(trace) {
  const spikes = spikeTimes(trace);
  let peak = -Infinity;
  let trough = Infinity;
  for (const value of trace.v) {
    if (value > peak) peak = value;
    if (value < trough) trough = value;
  }
  const intervals = spikes.slice(1).map((s, i) => s - spikes[i]);
  const lastInterval = intervals.length ? intervals[intervals.length - 1] : null;
  return {
    spikes: spikes.length,
    times: spikes,
    rest: trace.v[0],
    peak,
    trough,
    width: spikes.length ? spikeWidth(trace, spikes[0]) : null,
    rate: lastInterval ? 1000 / lastInterval : null,
  };
}
