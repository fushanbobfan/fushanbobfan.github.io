// Matching arcs on kites and darts. Each tile carries two circular arcs,
// one of each colour, and in a correct tiling the arcs join up across
// every edge into unbroken curves. The radii cut the edges in the golden
// ratio; with the long edge as 1:
//   colour 0: around the kite's tip, radius 1/φ, and the dart's tip, 1/φ²
//   colour 1: around the kite's tail, radius 1/φ², and the dart's dent, 1/φ³
// Arcs are built per half tile, so the two halves of a tile each draw half
// of every arc that crosses the axis.

import { PHI } from './tiling.js';

export const ARC_RULES = {
  kite: [
    { vertex: 'a', radius: 1 / PHI, colour: 0 },
    { vertex: 'c', radius: 1 / PHI ** 2, colour: 1 },
  ],
  dart: [
    { vertex: 'c', radius: 1 / PHI ** 2, colour: 0 },
    { vertex: 'a', radius: 1 / PHI ** 3, colour: 1 },
  ],
};

export function hasArcs(system) {
  return system === 'p2';
}

const OTHERS = { a: ['b', 'c'], b: ['c', 'a'], c: ['a', 'b'] };

// Arcs for the given half tiles, whose long edge is `edge` long. Each arc
// runs from angle `start` by `sweep` radians (positive is anticlockwise in
// world coordinates), centred on `centre`.
export function arcsFor(triangles, edge) {
  const arcs = [];
  for (const t of triangles) {
    const rules = ARC_RULES[t.kind];
    if (!rules) continue;
    for (const rule of rules) {
      const centre = t[rule.vertex];
      const [p, q] = OTHERS[rule.vertex].map((n) => t[n]);
      const start = Math.atan2(p[1] - centre[1], p[0] - centre[0]);
      const end = Math.atan2(q[1] - centre[1], q[0] - centre[0]);
      let sweep = end - start;
      if (sweep > Math.PI) sweep -= 2 * Math.PI;
      if (sweep < -Math.PI) sweep += 2 * Math.PI;
      arcs.push({ centre, radius: rule.radius * edge, start, sweep, colour: rule.colour });
    }
  }
  return arcs;
}

export function arcEnds(arc) {
  const { centre, radius, start, sweep } = arc;
  return [start, start + sweep].map((a) => [centre[0] + radius * Math.cos(a), centre[1] + radius * Math.sin(a)]);
}
