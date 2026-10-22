// The source's recent track: time, position and velocity samples covering
// the last `span` seconds, each with how far the wind had carried the air by
// then. A sample marked as a break starts a new piece, so the wrap of the
// straight line is never read as a dash across the screen.

export class History {
  constructor(span) {
    this.span = span;
    this.clear();
  }

  clear() {
    this.t = [];
    this.x = [];
    this.y = [];
    this.vx = [];
    this.vy = [];
    this.ax = [];
    this.ay = [];
    this.brk = [];
    this.start = 0;
  }

  get length() {
    return this.t.length - this.start;
  }

  push(t, x, y, vx, vy, brk = false, ax = 0, ay = 0) {
    this.t.push(t);
    this.x.push(x);
    this.y.push(y);
    this.vx.push(vx);
    this.vy.push(vy);
    this.ax.push(ax);
    this.ay.push(ay);
    this.brk.push(brk);
    // Keep one sample older than the span so a root at the edge is not lost.
    while (this.length > 2 && this.t[this.start + 1] < t - this.span) this.start++;
    if (this.start > 4096) this.compact();
  }

  compact() {
    for (const k of ['t', 'x', 'y', 'vx', 'vy', 'ax', 'ay', 'brk']) this[k] = this[k].slice(this.start);
    this.start = 0;
    this.brk[0] = true;
  }

  // Sample i counted from the oldest kept one.
  at(i) {
    const j = this.start + i;
    return {
      t: this.t[j], x: this.x[j], y: this.y[j], vx: this.vx[j], vy: this.vy[j],
      ax: this.ax[j], ay: this.ay[j], brk: i === 0 || this.brk[j],
    };
  }

  // Position and velocity a fraction s of the way from sample i-1 to i.
  lerp(i, s) {
    const a = this.start + i - 1;
    const b = a + 1;
    const m = (p) => p[a] + (p[b] - p[a]) * s;
    return { t: m(this.t), x: m(this.x), y: m(this.y), vx: m(this.vx), vy: m(this.vy), ax: m(this.ax), ay: m(this.ay) };
  }
}
