// Starting linkages. Each gives the pivots, the bar lengths, the coupler
// point offsets and a pose (crank angle and branch) to start from.

export const PRESETS = [
  {
    id: 'loop',
    name: 'Crank-rocker',
    note: 'The shortest bar is the crank, so it turns all the way round while the rocker swings back and forth.',
    link: { A: { x: 0, y: 0 }, D: { x: 4, y: 0 }, a: 1.5, b: 4, c: 3, u: 1.5, v: 1.6 },
    theta: Math.PI / 2,
    branch: 1,
  },
  {
    id: 'chebyshev',
    name: "Chebyshev's straight line",
    note: 'Bars in the ratio 4 : 5 : 2 : 5, crossed. The middle of the short coupler runs very nearly straight across the top of its path.',
    link: { A: { x: 0, y: 0 }, D: { x: 4, y: 0 }, a: 5, b: 2, c: 5, u: 1, v: 0 },
    theta: Math.atan2(4, 3),
    branch: -1,
  },
  {
    id: 'lambda',
    name: 'Chebyshev lambda',
    note: 'Ground 2, crank 1, rocker 2.5, and a coupler 5 long with the rocker pinned at its middle. Its free end traces the same curve as the crossed Chebyshev linkage, while the crank turns fully.',
    link: { A: { x: 0, y: 0 }, D: { x: 2, y: 0 }, a: 1, b: 2.5, c: 2.5, u: 5, v: 0 },
    theta: Math.PI,
    branch: 1,
  },
  {
    id: 'watt',
    name: "Watt's linkage",
    note: 'Two equal rockers pointing opposite ways and a short coupler between them. The coupler midpoint traces a figure eight whose middle stretch is nearly straight.',
    link: { A: { x: -3, y: 0.5 }, D: { x: 3, y: -0.5 }, a: 3, b: 1, c: 3, u: 0.5, v: 0 },
    theta: 0,
    branch: -1,
  },
  {
    id: 'drag',
    name: 'Drag link',
    note: 'The ground is the shortest bar, so both crank and rocker turn fully, the output speeding up and slowing down through each turn.',
    link: { A: { x: 0, y: 0 }, D: { x: 1, y: 0 }, a: 3, b: 3.5, c: 2.5, u: 1.2, v: 1.4 },
    theta: Math.PI / 2,
    branch: 1,
  },
  {
    id: 'triple',
    name: 'Triple rocker',
    note: 'Here s + l is greater than p + q, so no bar turns fully. The input rocks between two toggles and the loop changes assembly at each one.',
    link: { A: { x: 0, y: 0 }, D: { x: 4.5, y: 0 }, a: 2.6, b: 2.6, c: 2.6, u: 1.3, v: 1.2 },
    theta: Math.PI / 2,
    branch: 1,
  },
];
