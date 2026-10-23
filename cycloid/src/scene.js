// The fixed stage in metres, its mapping to the canvas, where B may go,
// and turning a pointer stroke into a path from A to B.

export const WORLD = { x0: -0.25, x1: 4.25, y0: -0.35, y1: 2.65 };
export const B_LIMITS = { xMin: 0.15, xMax: 4, yMin: 0.1, yMax: 2.4 };

export function fit(width, height, world = WORLD) {
  const scale = Math.min(width / (world.x1 - world.x0), height / (world.y1 - world.y0));
  const ox = (width - scale * (world.x1 - world.x0)) / 2 - scale * world.x0;
  const oy = (height - scale * (world.y1 - world.y0)) / 2 - scale * world.y0;
  return {
    scale,
    toScreen: (x, y) => [ox + scale * x, oy + scale * y],
    toWorld: (px, py) => [(px - ox) / scale, (py - oy) / scale],
  };
}

// The cycloid's dip below A never exceeds max(by, 2 bx / pi), so with B
// inside these limits it stays on the stage.
export function clampB(bx, by, lim = B_LIMITS) {
  return [Math.min(lim.xMax, Math.max(lim.xMin, bx)), Math.min(lim.yMax, Math.max(lim.yMin, by))];
}

// A stroke becomes A, the stroke's points at least `minStep` apart, then B.
export function sketchPath(stroke, bx, by, minStep = 0.02) {
  const out = [0, 0];
  let lx = 0, ly = 0;
  for (let i = 0; i < stroke.length; i += 2) {
    const x = stroke[i], y = stroke[i + 1];
    if (Math.hypot(x - lx, y - ly) < minStep || Math.hypot(x - bx, y - by) < minStep) continue;
    out.push(x, y);
    lx = x;
    ly = y;
  }
  out.push(bx, by);
  return Float64Array.from(out);
}
