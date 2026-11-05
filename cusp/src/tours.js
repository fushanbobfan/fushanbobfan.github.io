// Guided paths for the control point, placed from the cusps of the current machine.

function extent(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (Math.abs(p.y) > maxY) maxY = Math.abs(p.y);
  }
  return { minX, maxX, maxY };
}

// The tip of the diamond nearest the fixed point: the cusp with the largest x on the axis.
function nearTip(cusps, box) {
  const onAxis = cusps.filter((c) => Math.abs(c.y) < 1e-4);
  if (!onAxis.length) return { x: box.maxX, y: 0 };
  return onAxis.reduce((best, c) => (c.x > best.x ? c : best));
}

export const TOUR_NAMES = {
  snap: 'Down and back: two snaps',
  round: 'Round the cusp: no snap',
  level: 'Straight along: no snap',
  fork: 'Into the tip: which way?',
};

// Each tour is a polyline. `start` nudges the wheel into the well the story needs.
export function makeTour(name, chains, cusps) {
  const points = chains.flatMap((chain) => chain.points);
  const box = extent(points);
  const tip = nearTip(cusps, box);
  const midX = 0.5 * (box.minX + box.maxX);
  const reach = box.maxY + 0.3;
  if (name === 'snap') {
    return { path: [{ x: midX, y: reach }, { x: midX, y: -reach }, { x: midX, y: reach }], start: Math.PI / 2 };
  }
  if (name === 'round') {
    const radius = Math.max(0.2, 0.5 * box.maxY);
    const path = [];
    for (let i = 0; i <= 48; i += 1) {
      const a = Math.PI / 2 - (i / 48) * Math.PI;
      path.push({ x: tip.x + radius * Math.cos(a), y: radius * Math.sin(a) });
    }
    return { path, start: 0.6 };
  }
  if (name === 'level') {
    const y = 0.4 * box.maxY;
    return { path: [{ x: box.maxX + 0.45, y }, { x: box.minX - 0.45, y }], start: 0.5 };
  }
  if (name === 'fork') {
    return { path: [{ x: tip.x + 0.5, y: 0.012 }, { x: midX, y: 0.012 }], start: 0.1 };
  }
  throw new Error(`no tour named ${name}`);
}
