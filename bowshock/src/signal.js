// The pressure signal at the listener. The source emits a sine at the ring
// rate, so the image of emission time tau contributes sin(2 pi f tau), and
// a ring spreading in two dimensions weakens as one over the square root of
// how far it has travelled.

export function pressure(images, rate, near = 4) {
  let p = 0;
  for (const im of images) p += Math.sin(2 * Math.PI * rate * im.tau) / Math.sqrt(Math.max(near, im.dist));
  return p;
}

// A fixed-length record of the most recent samples, oldest first.
export class Trace {
  constructor(window) {
    this.window = window;
    this.t = [];
    this.v = [];
  }

  push(t, v) {
    this.t.push(t);
    this.v.push(v);
    let drop = 0;
    while (drop < this.t.length && this.t[drop] < t - this.window) drop++;
    if (drop > 0) {
      this.t.splice(0, drop);
      this.v.splice(0, drop);
    }
  }

  clear() {
    this.t = [];
    this.v = [];
  }

  // Largest absolute value held, for scaling the plot.
  peak() {
    let m = 0;
    for (const v of this.v) m = Math.max(m, Math.abs(v));
    return m;
  }
}
