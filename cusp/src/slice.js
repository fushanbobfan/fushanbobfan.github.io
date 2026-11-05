// A slice of the equilibrium surface: pin angles of rest along one straight line of
// control points. Inside the diamond the curve folds into an S.

import { curvature, torque } from './machine.js';

// The line runs along `axis` ('x' or 'y') with the other coordinate fixed at `at`.
export function controlOnLine(line, s) {
  return line.axis === 'y' ? { x: line.at, y: s } : { x: s, y: line.at };
}

export function positionOnLine(line, p) {
  return line.axis === 'y' ? p.y : p.x;
}

export function offsetOfLine(line, p) {
  return line.axis === 'y' ? p.x : p.y;
}

// The zero contour of the torque over (s, theta), by marching squares. Each segment
// is marked stable when the energy curves upward at its middle.
export function sliceCurve(m, line, range, { cols = 150, rows = 180 } = {}) {
  const [s0, s1] = range;
  const start = -Math.PI + 0.00137;
  const dTheta = (2 * Math.PI) / rows;
  const ds = (s1 - s0) / cols;
  const grid = new Float64Array((cols + 1) * (rows + 1));
  for (let i = 0; i <= cols; i += 1) {
    const c = controlOnLine(line, s0 + i * ds);
    for (let j = 0; j <= rows; j += 1) {
      grid[i * (rows + 1) + j] = torque(m, c.x, c.y, start + j * dTheta);
    }
  }
  const segments = [];
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      const g00 = grid[i * (rows + 1) + j];
      const g10 = grid[(i + 1) * (rows + 1) + j];
      const g01 = grid[i * (rows + 1) + j + 1];
      const g11 = grid[(i + 1) * (rows + 1) + j + 1];
      const crossings = [];
      const sLow = s0 + i * ds;
      const tLow = start + j * dTheta;
      if ((g00 > 0) !== (g10 > 0)) crossings.push([sLow + (ds * g00) / (g00 - g10), tLow]);
      if ((g10 > 0) !== (g11 > 0)) crossings.push([sLow + ds, tLow + (dTheta * g10) / (g10 - g11)]);
      if ((g01 > 0) !== (g11 > 0)) crossings.push([sLow + (ds * g01) / (g01 - g11), tLow + dTheta]);
      if ((g00 > 0) !== (g01 > 0)) crossings.push([sLow, tLow + (dTheta * g00) / (g00 - g01)]);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const [sa, ta] = crossings[k];
        const [sb, tb] = crossings[k + 1];
        const c = controlOnLine(line, 0.5 * (sa + sb));
        const stable = curvature(m, c.x, c.y, 0.5 * (ta + tb)) > 0;
        segments.push({ sa, ta, sb, tb, stable });
      }
    }
  }
  return segments;
}

// Where this line crosses the traced set, along the line.
export function foldsOnLine(chains, line) {
  const hits = [];
  for (const { points, closed } of chains) {
    const count = closed ? points.length : points.length - 1;
    for (let i = 0; i < count; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      const op = offsetOfLine(line, p);
      const oq = offsetOfLine(line, q);
      if ((op > line.at) !== (oq > line.at)) {
        const f = (line.at - op) / (oq - op);
        hits.push(positionOnLine(line, p) + f * (positionOnLine(line, q) - positionOnLine(line, p)));
      }
    }
  }
  return hits.sort((a, b) => a - b);
}

// There and back along the line from where C stands, far enough past the set to
// show a whole hysteresis loop. Stays inside `range`.
export function sweepAlong(line, from, folds, range, margin = 0.35) {
  const low = folds.length ? folds[0] - margin : range[0];
  const high = folds.length ? folds[folds.length - 1] + margin : range[1];
  const a = Math.max(range[0], low);
  const b = Math.min(range[1], high);
  const here = positionOnLine(line, from);
  const nearFirst = Math.abs(here - a) <= Math.abs(here - b) ? a : b;
  const farThen = nearFirst === a ? b : a;
  return [from, controlOnLine(line, nearFirst), controlOnLine(line, farThen), controlOnLine(line, nearFirst)];
}
