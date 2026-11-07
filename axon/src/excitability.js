// The classic measurements of an excitable membrane, each one a repeated
// experiment on the model: how strong a pulse must be, how soon it can repeat,
// and how fast a steady current drives it. They are generators that yield after
// every point, so a page can spread them over many frames.

import { simulate } from './simulate.js';

// A big enough pulse lifts the voltage past 0 mV with no channels at all, so a
// spike is judged by the sodium conductance it recruits. The value separates
// the two outcomes cleanly: see test/excitability.test.js.
export const SPIKE_CONDUCTANCE = 5;

function firesAfter(trace, from) {
  for (let i = 0; i < trace.t.length; i++) {
    if (trace.t[i] >= from && trace.gNa[i] >= SPIKE_CONDUCTANCE) return true;
  }
  return false;
}

// Smallest amplitude that fires, by bisection. fires(amplitude) must be false
// at low and true at high; returns null when even high fails.
export function bisect(fires, low, high, tolerance) {
  if (!fires(high)) return null;
  let a = low;
  let b = high;
  while (b - a > tolerance) {
    const middle = (a + b) / 2;
    if (fires(middle)) b = middle;
    else a = middle;
  }
  return b;
}

export function pulseThreshold(p, width, { high = 2000, tolerance = 0.01 } = {}) {
  const duration = Math.max(25, width + 25);
  const start = 2;
  return bisect((amplitude) => {
    const trace = simulate(p, [{ start, duration: width, amplitude }], { duration, samples: Math.round(duration * 10) });
    return firesAfter(trace, start);
  }, 0, high, tolerance);
}

export const WIDTHS = [0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 30, 50, 100];

export function* strengthDuration(p, widths = WIDTHS) {
  for (const width of widths) yield { width, threshold: pulseThreshold(p, width) };
}

// The weakest current that fires however long it lasts, and the width at which
// the threshold is twice that.
export function rheobaseAndChronaxie(points) {
  const rheobase = points[points.length - 1].threshold;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.threshold >= 2 * rheobase && b.threshold < 2 * rheobase) {
      const fraction = (Math.log(a.threshold) - Math.log(2 * rheobase)) / (Math.log(a.threshold) - Math.log(b.threshold));
      return { rheobase, chronaxie: Math.exp(Math.log(a.width) + fraction * (Math.log(b.width) - Math.log(a.width))) };
    }
  }
  return { rheobase, chronaxie: null };
}

// After a first spike, the strength a second 1 ms pulse needs at each delay.
// A threshold of null means even the strongest pulse tried failed.
// The delays start once the first spike has passed.
export const GAPS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 25, 30, 35, 40];
const CONDITIONING = { start: 2, duration: 1, amplitude: 15 };
export const STRONGEST_SECOND_PULSE = 200;

export function secondPulseThreshold(p, gap) {
  const secondStart = CONDITIONING.start + gap;
  const duration = secondStart + 25;
  return bisect((amplitude) => {
    const trace = simulate(p, [CONDITIONING, { start: secondStart, duration: 1, amplitude }], {
      duration,
      samples: Math.round(duration * 10),
    });
    return firesAfter(trace, secondStart);
  }, 0, STRONGEST_SECOND_PULSE, 0.05);
}

export function* recoveryCurve(p, gaps = GAPS) {
  for (const gap of gaps) yield { gap, threshold: secondPulseThreshold(p, gap) };
}

// Runs a generator to the end. Tests use this; pages step through it instead.
export function collect(generator) {
  return [...generator];
}
