// Measurement helpers: a rolling average for the status line, a binned
// flow-against-density record for the fundamental diagram, and the schedule
// that sweeps the density across its whole range to fill that diagram in.

/** Mean of the last `size` values pushed. */
export class RollingMean {
  constructor(size = 60) {
    this.size = size;
    this.values = new Float64Array(size);
    this.count = 0;
    this.index = 0;
    this.sum = 0;
  }

  push(x) {
    if (this.count === this.size) this.sum -= this.values[this.index];
    else this.count += 1;
    this.values[this.index] = x;
    this.sum += x;
    this.index = (this.index + 1) % this.size;
    return this.mean;
  }

  get mean() {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  reset() {
    this.values.fill(0);
    this.count = 0;
    this.index = 0;
    this.sum = 0;
  }
}

/**
 * Flow samples binned by density. Each bin keeps the running mean of every
 * flow measured while the road sat at a density inside it.
 */
export class FundamentalDiagram {
  constructor(bins = 100) {
    this.bins = bins;
    this.sum = new Float64Array(bins);
    this.n = new Uint32Array(bins);
  }

  binOf(density) {
    return Math.max(0, Math.min(this.bins - 1, Math.floor(density * this.bins)));
  }

  add(density, flow) {
    const b = this.binOf(density);
    this.sum[b] += flow;
    this.n[b] += 1;
  }

  /** Bins that hold data, as { density (bin centre), flow (mean), n }, ascending. */
  points() {
    const out = [];
    for (let b = 0; b < this.bins; b++) {
      if (this.n[b] === 0) continue;
      out.push({ density: (b + 0.5) / this.bins, flow: this.sum[b] / this.n[b], n: this.n[b] });
    }
    return out;
  }

  get size() {
    let k = 0;
    for (let b = 0; b < this.bins; b++) if (this.n[b] > 0) k += 1;
    return k;
  }

  clear() {
    this.sum.fill(0);
    this.n.fill(0);
  }
}

/**
 * A density sweep: hold each of `stops` densities from `from` to `to` for
 * `settle` steps without recording, then `sample` steps while recording.
 */
export function createSweep({ from = 0.02, to = 0.98, stops = 49, settle = 200, sample = 300 } = {}) {
  if (stops < 1) throw new RangeError('stops must be at least 1');
  return { from, to, stops, settle, sample, index: 0, tick: 0, done: false };
}

/** Density the sweep is holding at its current stop. */
export function sweepDensity(sweep) {
  if (sweep.stops === 1) return sweep.from;
  return sweep.from + ((sweep.to - sweep.from) * sweep.index) / (sweep.stops - 1);
}

/**
 * Advance the sweep by one simulation step. Returns whether this step should
 * be recorded, and whether the density changed so the caller must apply the
 * new value. `done` flips true after the last stop's last sample.
 */
export function sweepTick(sweep) {
  if (sweep.done) return { recording: false, changed: false, done: true };
  const recording = sweep.tick >= sweep.settle;
  sweep.tick += 1;
  let changed = false;
  if (sweep.tick >= sweep.settle + sweep.sample) {
    sweep.tick = 0;
    sweep.index += 1;
    if (sweep.index >= sweep.stops) {
      sweep.done = true;
    } else {
      changed = true;
    }
  }
  return { recording, changed, done: sweep.done };
}

/** Fraction of the sweep completed, in [0, 1]. */
export function sweepProgress(sweep) {
  if (sweep.done) return 1;
  const perStop = sweep.settle + sweep.sample;
  return (sweep.index * perStop + sweep.tick) / (sweep.stops * perStop);
}
