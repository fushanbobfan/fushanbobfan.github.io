// The world the source moves in and the paths it can follow. Lengths are in
// metres-like world units and times in seconds; sound travels at
// SOUND_SPEED through still air.

export const WORLD = Object.freeze({ width: 160, height: 100 });
export const SOUND_SPEED = 25;

export const PATHS = ['line', 'circle', 'drag', 'still'];

// How far past either edge the straight-line source travels before it wraps
// round to the other side.
export const LINE_MARGIN = 30;

export function circleRadius(world = WORLD) {
  return Math.min(world.width, world.height) * 0.32;
}

// Source state after travelling a distance d along one of the analytic
// paths at the given speed. Going by distance rather than time lets the
// speed change mid-run without the source jumping. `lap` counts wraps of the
// straight line so callers can tell a jump from motion.
export function pathAt(path, d, speed, world = WORLD) {
  const cx = world.width / 2;
  const cy = world.height / 2;
  if (path === 'line') {
    const span = world.width + 2 * LINE_MARGIN;
    const run = d + LINE_MARGIN + world.width * 0.15;
    const lap = Math.floor(run / span);
    return { x: run - lap * span - LINE_MARGIN, y: cy, vx: speed, vy: 0, lap };
  }
  if (path === 'circle') {
    const r = circleRadius(world);
    const a = d / r - Math.PI / 2;
    const w = speed / r;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), vx: -r * w * Math.sin(a), vy: r * w * Math.cos(a), lap: 0 };
  }
  return { x: cx, y: cy, vx: 0, vy: 0, lap: 0 };
}

// One step of the hand-steered source: it heads for the pointer at a speed
// proportional to the distance, never faster than maxSpeed.
export function steer(src, target, dt, maxSpeed, gain = 4) {
  let vx = (target.x - src.x) * gain;
  let vy = (target.y - src.y) * gain;
  const v = Math.hypot(vx, vy);
  if (v > maxSpeed) {
    vx *= maxSpeed / v;
    vy *= maxSpeed / v;
  }
  return { x: src.x + vx * dt, y: src.y + vy * dt, vx, vy, lap: src.lap ?? 0 };
}
