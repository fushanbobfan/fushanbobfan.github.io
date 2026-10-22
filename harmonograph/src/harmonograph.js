// Harmonograph model: a pen whose position is a sum of damped sinusoids.
//
// Each pendulum swings along one axis ("x" or "y") or, for a rotary
// pendulum, in a circle that moves the pen along both axes at once.
// A pendulum's displacement at time t (seconds) is
//
//   amp * sin(2π · freq · t + phase) * exp(-damp · t)
//
// and the pen position is the sum of all displacements on each axis.

const TAU = Math.PI * 2;

export const AXES = ['x', 'y', 'rotary'];

export const LIMITS = {
  amp: [0, 1],
  freq: [0.1, 12],
  phase: [-Math.PI, Math.PI],
  damp: [0, 0.2],
};

function clamp(value, [lo, hi]) {
  const n = Number(value);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function wrapPhase(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const wrapped = ((n + Math.PI) % TAU + TAU) % TAU - Math.PI;
  // Keep +π as +π instead of folding it to -π, so the slider end stays put.
  return wrapped === -Math.PI && n > 0 ? Math.PI : wrapped;
}

export function normalizePendulum(p = {}) {
  return {
    axis: AXES.includes(p.axis) ? p.axis : 'x',
    amp: clamp(p.amp ?? 0.5, LIMITS.amp),
    freq: clamp(p.freq ?? 2, LIMITS.freq),
    phase: wrapPhase(p.phase ?? 0),
    damp: clamp(p.damp ?? 0.01, LIMITS.damp),
  };
}

export function normalizeDesign(design = {}) {
  const pendulums = Array.isArray(design.pendulums) ? design.pendulums : [];
  return { pendulums: pendulums.slice(0, 6).map(normalizePendulum) };
}

export function displacement(p, t) {
  return p.amp * Math.sin(TAU * p.freq * t + p.phase) * Math.exp(-p.damp * t);
}

export function penPosition(design, t) {
  let x = 0;
  let y = 0;
  for (const p of design.pendulums) {
    const decay = p.amp * Math.exp(-p.damp * t);
    const angle = TAU * p.freq * t + p.phase;
    if (p.axis === 'x') {
      x += decay * Math.sin(angle);
    } else if (p.axis === 'y') {
      y += decay * Math.sin(angle);
    } else {
      x += decay * Math.sin(angle);
      y += decay * Math.cos(angle);
    }
  }
  return { x, y };
}

// Largest distance the pen can still travel from the centre at time t.
export function envelope(design, t) {
  let x = 0;
  let y = 0;
  for (const p of design.pendulums) {
    const a = p.amp * Math.exp(-p.damp * t);
    if (p.axis !== 'y') x += a;
    if (p.axis !== 'x') y += a;
  }
  return Math.hypot(x, y);
}

// Time until the swing has decayed to `fraction` of its starting reach,
// capped so undamped designs still finish.
export function settleTime(design, fraction = 0.02, cap = 600) {
  const start = envelope(design, 0);
  if (start === 0) return 0;
  const target = start * fraction;
  if (envelope(design, cap) > target) return cap;
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (envelope(design, mid) > target) lo = mid;
    else hi = mid;
  }
  return hi;
}

// Sample the pen path as interleaved [x0, y0, x1, y1, ...].
export function sampleCurve(design, { duration, samplesPerSecond = 240, start = 0 } = {}) {
  const span = Math.max(0, duration ?? settleTime(design));
  const count = Math.max(2, Math.ceil(span * samplesPerSecond) + 1);
  const out = new Float64Array(count * 2);
  for (let i = 0; i < count; i++) {
    const t = start + (span * i) / (count - 1);
    const { x, y } = penPosition(design, t);
    out[2 * i] = x;
    out[2 * i + 1] = y;
  }
  return out;
}

export function bounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

// Map model coordinates into a width×height box, centred, uniform scale,
// with y pointing up as in a plotted figure.
export function fitTransform(box, width, height, margin = 24) {
  const w = Math.max(box.maxX - box.minX, 1e-9);
  const h = Math.max(box.maxY - box.minY, 1e-9);
  const scale = Math.min((width - 2 * margin) / w, (height - 2 * margin) / h);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return {
    scale,
    toScreen(x, y) {
      return [width / 2 + (x - cx) * scale, height / 2 - (y - cy) * scale];
    },
  };
}
