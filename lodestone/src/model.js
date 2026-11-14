// A pendulum bob swinging over magnets, seen from above.
//
// The bob moves in the plane under three forces: a spring-like pull back to
// the centre (gravity on a long pendulum), friction proportional to speed, and
// an attraction to each magnet. Magnet i sits a height h below the bob's plane,
// so its pull is s_i (m_i - r) / (|m_i - r|^2 + h^2)^(3/2) and never blows up.

export const DEFAULTS = Object.freeze({
  pull: 0.5, // k, strength of the pull back to the centre
  friction: 0.2, // b, drag per unit speed
  height: 0.25, // h, gap between the bob's plane and the magnets
  dt: 0.02,
  maxTime: 200,
});

export function regularMagnets(count, radius = 1, strength = 1, turn = Math.PI / 2) {
  const magnets = [];
  for (let i = 0; i < count; i++) {
    const a = turn + (2 * Math.PI * i) / count;
    magnets.push({ x: radius * Math.cos(a), y: radius * Math.sin(a), strength });
  }
  return magnets;
}

export function makeSystem(magnets, options = {}) {
  const sys = { ...DEFAULTS, ...options, magnets: magnets.map((m) => ({ ...m })) };
  sys.traps = magnetTraps(sys);
  return sys;
}

export function acceleration(sys, x, y, vx, vy, out = [0, 0]) {
  const h2 = sys.height * sys.height;
  let ax = -sys.pull * x - sys.friction * vx;
  let ay = -sys.pull * y - sys.friction * vy;
  for (const m of sys.magnets) {
    const dx = m.x - x;
    const dy = m.y - y;
    const q = dx * dx + dy * dy + h2;
    const f = m.strength / (q * Math.sqrt(q));
    ax += f * dx;
    ay += f * dy;
  }
  out[0] = ax;
  out[1] = ay;
  return out;
}

export function potential(sys, x, y) {
  const h2 = sys.height * sys.height;
  let v = 0.5 * sys.pull * (x * x + y * y);
  for (const m of sys.magnets) {
    const dx = m.x - x;
    const dy = m.y - y;
    v -= m.strength / Math.sqrt(dx * dx + dy * dy + h2);
  }
  return v;
}

export function energy(sys, s) {
  return 0.5 * (s.vx * s.vx + s.vy * s.vy) + potential(sys, s.x, s.y);
}

const k1 = [0, 0], k2 = [0, 0], k3 = [0, 0], k4 = [0, 0];

function rk4(sys, s, dt) {
  const { x, y, vx, vy } = s;
  const h = dt / 2;
  acceleration(sys, x, y, vx, vy, k1);
  const x2 = x + h * vx, y2 = y + h * vy, vx2 = vx + h * k1[0], vy2 = vy + h * k1[1];
  acceleration(sys, x2, y2, vx2, vy2, k2);
  const x3 = x + h * vx2, y3 = y + h * vy2, vx3 = vx + h * k2[0], vy3 = vy + h * k2[1];
  acceleration(sys, x3, y3, vx3, vy3, k3);
  const x4 = x + dt * vx3, y4 = y + dt * vy3, vx4 = vx + dt * k3[0], vy4 = vy + dt * k3[1];
  acceleration(sys, x4, y4, vx4, vy4, k4);
  s.x = x + (dt / 6) * (vx + 2 * vx2 + 2 * vx3 + vx4);
  s.y = y + (dt / 6) * (vy + 2 * vy2 + 2 * vy3 + vy4);
  s.vx = vx + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  s.vy = vy + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
}

// How many pieces to cut a step into. Close to a magnet the pull changes over
// a time of about q^(3/4) / sqrt(s), with q the squared distance plus h^2;
// each piece is kept to a small fraction of that, and of the bob's crossing time.
export function substeps(sys, s, dt = sys.dt) {
  const h2 = sys.height * sys.height;
  const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  let tau = Infinity;
  for (const m of sys.magnets) {
    const dx = m.x - s.x;
    const dy = m.y - s.y;
    const r = Math.sqrt(dx * dx + dy * dy + h2);
    tau = Math.min(tau, (r * Math.sqrt(r)) / Math.sqrt(Math.abs(m.strength) || 1e-12));
    if (speed > 0) tau = Math.min(tau, r / speed);
  }
  const n = Math.ceil(dt / (0.1 * tau));
  return n <= 1 ? 1 : Math.min(64, n);
}

// Advance the state {x, y, vx, vy} by dt in place, with classical Runge-Kutta
// steps, cut finer when the bob passes close to a magnet.
export function step(sys, s, dt = sys.dt) {
  const n = substeps(sys, s, dt);
  for (let i = 0; i < n; i++) rk4(sys, s, dt / n);
  return s;
}

// Steepest the potential can be anywhere near magnet m within distance R:
// the centre pull is at most k (|m| + R), and each magnet's pull at most
// s * 2 / (3 sqrt 3 h^2), the peak of d / (d^2 + h^2)^(3/2).
function slopeBound(sys, m, radius) {
  const h2 = sys.height * sys.height;
  let g = sys.pull * (Math.hypot(m.x, m.y) + radius);
  for (const o of sys.magnets) g += (Math.abs(o.strength) * 2) / (3 * Math.sqrt(3) * h2);
  return g;
}

// A trap is a disc around a magnet and a level below every point of its rim.
// Friction only ever lowers the energy, so a bob inside the disc with energy
// under that level can never climb out: its fate is settled from that moment.
// The rim is sampled, and the level is the lowest sample minus the most the
// potential can fall between neighbouring samples, so it is a true lower bound.
export function magnetTraps(sys, samples = 720) {
  const ms = sys.magnets;
  return ms.map((m, i) => {
    let nearest = Infinity;
    for (let j = 0; j < ms.length; j++) {
      if (j !== i) nearest = Math.min(nearest, Math.hypot(ms[i].x - ms[j].x, ms[i].y - ms[j].y));
    }
    // Neighbouring discs reach at most 0.45 of the gap each, so they never overlap.
    const radius = Math.min(0.45 * nearest, 0.6);
    let lowest = Infinity;
    for (let k = 0; k < samples; k++) {
      const a = (2 * Math.PI * k) / samples;
      lowest = Math.min(lowest, potential(sys, m.x + radius * Math.cos(a), m.y + radius * Math.sin(a)));
    }
    const gap = (Math.PI * radius) / samples; // farthest any rim point is from a sample
    const rim = lowest - slopeBound(sys, m, radius) * gap;
    // Whether the potential dips under that level anywhere in the disc; if not,
    // no bob can ever meet the trap's condition. For display and tests only.
    let floor = Infinity;
    const n = 24;
    for (let a = 0; a <= n; a++) {
      for (let b = 0; b <= n; b++) {
        const dx = radius * (2 * a / n - 1);
        const dy = radius * (2 * b / n - 1);
        if (dx * dx + dy * dy <= radius * radius) floor = Math.min(floor, potential(sys, m.x + dx, m.y + dy));
      }
    }
    return { x: m.x, y: m.y, radius, rim, hasWell: floor < rim };
  });
}

export function trappedBy(sys, s) {
  const e = energy(sys, s);
  for (let i = 0; i < sys.traps.length; i++) {
    const t = sys.traps[i];
    if (e >= t.rim) continue;
    const dx = s.x - t.x;
    const dy = s.y - t.y;
    if (dx * dx + dy * dy < t.radius * t.radius) return i;
  }
  return -1;
}

const acc = [0, 0];

// Release the bob at rest from (x, y) and follow it until a magnet traps it.
// Returns the magnet's index and the time taken, or -1 if no magnet caught it:
// either it came to rest somewhere else, or maxTime ran out.
export function fate(sys, x, y, vx = 0, vy = 0) {
  const s = { x, y, vx, vy };
  const steps = Math.ceil(sys.maxTime / sys.dt);
  for (let n = 0; n <= steps; n++) {
    const i = trappedBy(sys, s);
    if (i >= 0) return { magnet: i, time: n * sys.dt };
    if (n % 50 === 0) {
      acceleration(sys, s.x, s.y, s.vx, s.vy, acc);
      if (s.vx * s.vx + s.vy * s.vy < 1e-14 && acc[0] * acc[0] + acc[1] * acc[1] < 1e-14) {
        return { magnet: -1, time: n * sys.dt };
      }
    }
    step(sys, s);
  }
  return { magnet: -1, time: sys.maxTime };
}
