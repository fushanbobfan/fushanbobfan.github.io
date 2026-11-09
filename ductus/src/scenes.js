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
    id: 'circle',
    name: 'A quarter circle',
    note: 'No polynomial curve is exactly a circle, but a weighted one is. With the middle weight at cos 45° ≈ 0.707 this quadratic is a true quarter circle: the comb is a band of equal teeth. Change the weight and it becomes an ellipse or a hyperbola.',
    points: [[120, 480], [120, 120, Math.SQRT1_2], [480, 120]],
  },
  {
    id: 'pull',
    name: 'Weighted cubic',
    note: 'A heavy weight pulls the curve toward its control point and a light one lets it go. Weights change the curve without moving any point. Rational curves can draw exact circles and other conics, which is why CAD programs build their shapes from them (as NURBS).',
    points: [[90, 480], [170, 130, 3], [430, 130, 0.4], [510, 480]],
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
  return scene.points.map(([x, y, w]) => (w === undefined ? { x, y } : { x, y, w }));
}

export const MIN_WEIGHT = 0.25;
export const MAX_WEIGHT = 4;

// Weights move on a log scale, so halving and doubling are equal steps.
export function weightFromSlider(v) {
  return Math.pow(2, v);
}

export function sliderFromWeight(w) {
  return Math.log2(w === undefined ? 1 : w);
}

export function withWeight(points, index, w) {
  const clamped = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, w));
  return points.map((p, i) => (i === index ? { ...p, w: clamped } : p));
}

// Shortens the longer leg until both legs are equally long, then gives the
// middle point the weight that makes the quadratic a circular arc. Points only
// move toward the middle point, so they stay on the board.
export function asCircularArc(points, circleWeight) {
  if (points.length !== 3) return points;
  const [a, b, c] = points;
  const legA = Math.hypot(a.x - b.x, a.y - b.y);
  const legC = Math.hypot(c.x - b.x, c.y - b.y);
  if (legA < 1 || legC < 1) return points;
  const leg = Math.min(legA, legC);
  const along = (p, len) => ({ x: b.x + ((p.x - b.x) / len) * leg, y: b.y + ((p.y - b.y) / len) * leg });
  const even = [along(a, legA), { x: b.x, y: b.y }, along(c, legC)];
  return withWeight(even, 1, circleWeight(even));
}

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
    ...p,
    x: Math.min(BOARD - margin, Math.max(margin, p.x)),
    y: Math.min(BOARD - margin, Math.max(margin, p.y)),
  };
}
