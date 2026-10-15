// Bifurcation diagram: sweep one parameter across its range and, for each
// value, plot the successive maxima of one coordinate once the orbit has
// settled. A periodic orbit leaves a few dots in its column; chaos fills it.
// Columns are computed one at a time so the page can spread the work over
// animation frames.

import { createStepper, isFiniteState } from './integrate.js';

export function createSweep(system, baseParams, { key, from, to, columns = 240, axis, transientTime = 150, sampleTime = 150, maxPerColumn = 120, dt = system.dt } = {}) {
  const q = system.params.find((p) => p.key === key);
  if (!q) throw new Error(`unknown parameter ${key}`);
  const lo = from ?? q.min;
  const hi = to ?? q.max;
  const ax = axis ?? system.mapAxis ?? system.up;
  const results = [];
  // Each column starts where the previous one ended (continuation), so a
  // branch is followed smoothly as the parameter moves.
  let state = Float64Array.from(system.start);
  const transient = Math.round(transientTime / dt);
  const samples = Math.round(sampleTime / dt);

  function computeColumn(i) {
    const value = columns === 1 ? lo : lo + ((hi - lo) * i) / (columns - 1);
    const params = { ...baseParams, [key]: value };
    const step = createStepper(system.field, params);
    const s = isFiniteState(state) && magnitude(state) < 1e5 ? state : Float64Array.from(system.start);
    const maxima = [];
    let escaped = false;
    for (let k = 0; k < transient; k++) {
      step(s, dt);
      if (!isFiniteState(s) || magnitude(s) > 1e6) {
        escaped = true;
        break;
      }
    }
    if (!escaped) {
      let y0 = s[ax];
      step(s, dt);
      let y1 = s[ax];
      for (let k = 0; k < samples && maxima.length < maxPerColumn; k++) {
        step(s, dt);
        if (!isFiniteState(s) || magnitude(s) > 1e6) {
          escaped = true;
          break;
        }
        const y2 = s[ax];
        if (y1 > y0 && y1 >= y2) {
          const denom = y0 - 2 * y1 + y2;
          maxima.push(denom < 0 ? y1 - ((y2 - y0) * (y2 - y0)) / (8 * denom) : y1);
        }
        y0 = y1;
        y1 = y2;
      }
    }
    state = escaped ? Float64Array.from(system.start) : s;
    return { value, maxima, escaped };
  }

  return {
    key,
    from: lo,
    to: hi,
    axis: ax,
    columns,
    results,
    get done() {
      return results.length >= columns;
    },
    // Computes columns until `budgetMs` has passed (or `maxColumns` are done).
    advance(budgetMs = Infinity, maxColumns = Infinity, now = () => Date.now()) {
      const start = now();
      let n = 0;
      while (results.length < columns && n < maxColumns) {
        results.push(computeColumn(results.length));
        n++;
        if (now() - start >= budgetMs) break;
      }
      return n;
    },
    // Parameter value at a fractional position 0..1 along the sweep.
    valueAt(f) {
      return lo + (hi - lo) * Math.min(1, Math.max(0, f));
    },
  };
}

function magnitude(s) {
  return Math.abs(s[0]) + Math.abs(s[1]) + Math.abs(s[2]);
}

export function maximaRange(results) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of results) {
    for (const m of r.maxima) {
      if (m < lo) lo = m;
      if (m > hi) hi = m;
    }
  }
  return lo <= hi ? { lo, hi } : null;
}
