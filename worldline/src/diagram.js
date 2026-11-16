// Geometry of the drawing: where things land on the canvas for a given viewing frame.
// Events are stored in lab coordinates and shown in the coordinates of the viewing frame.

import { boost, unboost, relativeVelocity } from './lorentz.js';

// A square view centred on the origin: x runs right, t runs up, `half` units to each edge.
export function makeView(size, half) {
  const scale = size / (2 * half);
  return {
    size,
    half,
    toCanvas(p) {
      return [(p.x + half) * scale, (half - p.t) * scale];
    },
    fromCanvas(px, py) {
      return { x: px / scale - half, t: half - py / scale };
    },
    scale,
  };
}

// Lab event -> where it is drawn when looking from viewBeta.
export function toView(event, viewBeta) {
  return boost(event, viewBeta);
}

// Drawn position (viewing-frame coordinates) -> lab event.
export function fromView(point, viewBeta) {
  return unboost(point, viewBeta);
}

// A point given in the coordinates of the frame moving at frameBeta, as drawn from viewBeta.
export function frameToView(point, frameBeta, viewBeta) {
  return toView(unboost(point, frameBeta), viewBeta);
}

// Grid lines of a frame, each a pair of drawn points far enough apart to cross the whole view.
// Lines of constant x' are that frame's clocks sitting still; lines of constant t' are its "now".
export function frameGrid(frameBeta, viewBeta, half, spacing = 1) {
  const reach = half * 12; // long enough to span the view even for fast frames
  const count = Math.ceil((half * 8) / spacing);
  const lines = [];
  for (let k = -count; k <= count; k++) {
    const c = k * spacing;
    lines.push({
      kind: 'place',
      value: c,
      a: frameToView({ t: -reach, x: c }, frameBeta, viewBeta),
      b: frameToView({ t: reach, x: c }, frameBeta, viewBeta),
    });
    lines.push({
      kind: 'moment',
      value: c,
      a: frameToView({ t: c, x: -reach }, frameBeta, viewBeta),
      b: frameToView({ t: c, x: reach }, frameBeta, viewBeta),
    });
  }
  return lines;
}

// The frame's own time axis (x' = 0) and space axis (t' = 0) through the origin, as drawn.
export function frameAxes(frameBeta, viewBeta, length) {
  return {
    time: [frameToView({ t: -length, x: 0 }, frameBeta, viewBeta), frameToView({ t: length, x: 0 }, frameBeta, viewBeta)],
    space: [frameToView({ t: 0, x: -length }, frameBeta, viewBeta), frameToView({ t: 0, x: length }, frameBeta, viewBeta)],
    velocity: relativeVelocity(frameBeta, viewBeta),
  };
}

// The line of events that a frame calls simultaneous with `event`, as drawn.
export function simultaneityLine(event, frameBeta, viewBeta, length) {
  const inFrame = boost(event, frameBeta);
  return [
    frameToView({ t: inFrame.t, x: inFrame.x - length }, frameBeta, viewBeta),
    frameToView({ t: inFrame.t, x: inFrame.x + length }, frameBeta, viewBeta),
  ];
}

// Hyperbola t^2 - x^2 = s2 through the origin. It looks the same from every frame,
// which is the point of drawing it. Returns separate branches as lists of points.
export function invariantHyperbola(s2, reach, steps = 120) {
  const s = Math.sqrt(Math.abs(s2));
  const phiMax = Math.acosh(Math.max(1, reach / s));
  const branches = [[], []];
  for (let i = 0; i <= steps; i++) {
    const phi = -phiMax + (2 * phiMax * i) / steps;
    const c = s * Math.cosh(phi);
    const h = s * Math.sinh(phi);
    if (s2 > 0) {
      branches[0].push({ t: c, x: h });
      branches[1].push({ t: -c, x: h });
    } else {
      branches[0].push({ t: h, x: c });
      branches[1].push({ t: h, x: -c });
    }
  }
  return branches;
}

// Index of the event drawn nearest to a canvas point, within `radius` pixels, or -1.
export function pick(events, viewBeta, view, px, py, radius = 12) {
  let best = -1;
  let bestD = radius;
  events.forEach((e, i) => {
    const [cx, cy] = view.toCanvas(toView(e, viewBeta));
    const d = Math.hypot(cx - px, cy - py);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

export function labelFor(index) {
  return String.fromCharCode(65 + (index % 26));
}
