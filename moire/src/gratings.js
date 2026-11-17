// A grating is a printed transparency: opaque marks repeating with a fixed
// period. Lines are straight bars, rings are concentric circles, dots sit on a
// square lattice. Positions and periods are in CSS pixels.
//
// Each layer: { kind, period, angle (radians), x, y, duty }
//   x, y  a point the pattern is anchored to (ring centre, lattice origin)
//   duty  fraction of each period covered by ink (dots: fraction of the area)

export const KINDS = ['lines', 'rings', 'dots'];

// Dots wider than this would touch their neighbours.
export const MAX_DOT_DUTY = Math.PI / 4;

export function makeLayer(props = {}) {
  return {
    kind: 'lines',
    period: 10,
    angle: 0,
    x: 0,
    y: 0,
    duty: 0.5,
    ...props,
  };
}

// Ink accumulated from phase 0 up to phase t (in cycles) when each cycle is
// inked on [0, duty). Differencing it gives the exact ink over an interval.
export function inkUpTo(t, duty) {
  const n = Math.floor(t);
  return n * duty + Math.min(t - n, duty);
}

// Fraction of the interval [t - w/2, t + w/2] (in cycles) that is inked:
// a square wave seen through a box filter of width w.
export function boxInk(t, w, duty) {
  if (w <= 1e-9) {
    const f = t - Math.floor(t);
    return f < duty ? 1 : 0;
  }
  return (inkUpTo(t + w / 2, duty) - inkUpTo(t - w / 2, duty)) / w;
}

// Position of (px, py) inside the pattern, in cycles. Lines and rings have one
// coordinate, dots two (along and across the lattice).
export function phases(layer, px, py) {
  const dx = px - layer.x;
  const dy = py - layer.y;
  if (layer.kind === 'rings') return [Math.hypot(dx, dy) / layer.period];
  const c = Math.cos(layer.angle);
  const s = Math.sin(layer.angle);
  const u = (dx * c + dy * s) / layer.period;
  if (layer.kind === 'lines') return [u];
  return [u, (-dx * s + dy * c) / layer.period];
}

// How much of a square pixel of side `foot`, centred on (px, py), is covered
// by ink, from 0 (clear) to 1 (opaque).
export function inkAt(layer, px, py, foot = 1) {
  const p = phases(layer, px, py);
  if (layer.kind === 'lines') {
    const c = Math.abs(Math.cos(layer.angle));
    const s = Math.abs(Math.sin(layer.angle));
    return boxInk(p[0], (foot * (c + s)) / layer.period, layer.duty);
  }
  if (layer.kind === 'rings') {
    return boxInk(p[0], foot / layer.period, layer.duty);
  }
  const duty = Math.min(layer.duty, MAX_DOT_DUTY);
  const radius = layer.period * Math.sqrt(duty / Math.PI);
  const du = (p[0] - Math.round(p[0])) * layer.period;
  const dv = (p[1] - Math.round(p[1])) * layer.period;
  const edge = radius - Math.hypot(du, dv);
  return Math.min(1, Math.max(0, edge / foot + 0.5));
}
