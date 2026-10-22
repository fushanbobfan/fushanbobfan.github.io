// Spotting when an ant settles into a repeating pattern.
//
// Each step the ant contributes one symbol (the colour it read and the way
// it was facing) and its position. Once the recent symbols repeat with some
// period p, the ant's motion repeats too: after every p steps it has moved by
// the same offset. A non-zero offset is a highway; a zero offset is a loop
// in place.

// Smallest p with s[i] === s[i + p] for every i in s[start, start + len).
export function smallestPeriod(s, start, len) {
  const pi = new Int32Array(len);
  for (let i = 1; i < len; i++) {
    let k = pi[i - 1];
    while (k > 0 && s[start + i] !== s[start + k]) k = pi[k - 1];
    if (s[start + i] === s[start + k]) k++;
    pi[i] = k;
  }
  return len - pi[len - 1];
}

export class PeriodWatch {
  constructor(capacity = 1 << 15) {
    this.capacity = capacity;
    this.mask = capacity - 1;
    this.sym = new Int32Array(capacity);
    this.xs = new Int32Array(capacity);
    this.ys = new Int32Array(capacity);
    this.count = 0;
  }

  push(symbol, x, y) {
    const k = this.count & this.mask;
    this.sym[k] = symbol;
    this.xs[k] = x;
    this.ys[k] = y;
    this.count++;
  }

  symAt(t) {
    return this.sym[t & this.mask];
  }

  // Look at the last `tail` steps, for each tail length in turn, for a
  // pattern repeated at least `minReps` times. Short tails catch a fresh
  // highway before the chaos ahead of it slides out of view; long ones catch
  // long periods. Returns null or { period, dx, dy, onset, onsetExact }, where
  // onset is the first step of the repeating stretch (exact when the stretch
  // began inside the remembered history, otherwise an upper bound).
  detect(tails = [1024, 4096, 8192], minReps = 3) {
    for (const tail of tails) {
      if (tail > this.count || tail > this.capacity) break;
      const found = this.#detectTail(tail, minReps);
      if (found) return found;
    }
    return null;
  }

  #detectTail(tail, minReps) {
    const first = this.count - tail;
    const window = new Int32Array(tail);
    for (let i = 0; i < tail; i++) window[i] = this.symAt(first + i);
    const period = smallestPeriod(window, 0, tail);
    if (period * minReps > tail) return null;

    const last = this.count - 1;
    const back = last - period;
    const dx = this.xs[last & this.mask] - this.xs[back & this.mask];
    const dy = this.ys[last & this.mask] - this.ys[back & this.mask];

    const oldest = Math.max(0, this.count - this.capacity);
    let onset = first;
    while (onset - 1 >= oldest && this.symAt(onset - 1) === this.symAt(onset - 1 + period)) onset--;
    return { period, dx, dy, onset, onsetExact: onset > oldest || oldest === 0 };
  }
}
