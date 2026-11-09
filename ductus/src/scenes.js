// Starting curves, in a 600 × 600 board with y pointing down.

export const BOARD = 600;
export const MIN_POINTS = 2;
export const MAX_POINTS = 9;

export const SCENES = [
  {
    id: 'cubic',
    name: 'A cubic arch',
    note: 'Four control points, three levels of construction. The curve leaves along the first leg of the polygon and arrives along the last.',
    points: [[90, 480], [170, 130], [430, 130], [510, 480]],
  },
  {
    id: 'quadratic',
    name: 'A parabola',
    note: 'Three control points make a quadratic Bézier curve, which is always a piece of a parabola. Its curvature is greatest near the middle control point.',
    points: [[90, 470], [300, 90], [510, 470]],
  },
  {
    id: 'inflection',
    name: 'An S bend',
    note: 'The comb swaps sides where the curve stops turning one way and starts turning the other: an inflection point, where the curvature passes through zero.',
    points: [[80, 420], [250, 60], [350, 540], [520, 180]],
  },
  {
    id: 'loop',
    name: 'A loop',
    note: 'Cross the two middle control points and a cubic ties itself in a loop. The curvature peaks where the loop is tightest.',
    points: [[100, 430], [560, 140], [40, 140], [500, 430]],
  },
  {
    id: 'cusp',
    name: 'Almost a cusp',
    note: 'Pull the middle points until the loop shrinks to nothing and the curve develops a sharp point. There the speed falls to zero and the curvature blows up.',
    points: [[100, 440], [470, 170], [130, 170], [500, 440]],
  },
  {
    id: 'wave',
    name: 'Seven points',
    note: 'A degree-six curve. Each control point pulls on the whole curve, but most strongly near its own share of the parameter, so the curve smooths the polygon out.',
    points: [[60, 300], [140, 90], [220, 510], [300, 90], [380, 510], [460, 90], [540, 300]],
  },
];

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}

export function scenePoints(scene) {
  return scene.points.map(([x, y]) => ({ x, y }));
}

// A new control point goes halfway along the last leg, pushed a little off it,
// so the curve visibly changes.
export function withExtraPoint(points) {
  if (points.length >= MAX_POINTS) return points;
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const push = Math.min(60, len / 3);
  const p = clampToBoard({ x: mid.x + ((b.y - a.y) / len) * push, y: mid.y - ((b.x - a.x) / len) * push });
  return [...points.slice(0, -1), p, b];
}

export function withoutPoint(points, index) {
  if (points.length <= MIN_POINTS) return points;
  return points.filter((_, i) => i !== index);
}

export function clampToBoard(p, margin = 8) {
  return {
    x: Math.min(BOARD - margin, Math.max(margin, p.x)),
    y: Math.min(BOARD - margin, Math.max(margin, p.y)),
  };
}
