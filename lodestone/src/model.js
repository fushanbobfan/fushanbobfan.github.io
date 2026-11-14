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

// One classical Runge-Kutta step of the state {x, y, vx, vy}, in place.
export function step(sys, s, dt = sys.dt) {
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
  return s;
}

// A trap is a disc around a magnet with the lowest potential on its rim.
// Friction only ever lowers the energy, so a bob inside the disc whose energy
// is below that rim can never climb out: its fate is settled from that moment.
export function magnetTraps(sys, samples = 72) {
  const ms = sys.magnets;
  let spacing = Infinity;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      spacing = Math.min(spacing, Math.hypot(ms[i].x - ms[j].x, ms[i].y - ms[j].y));
    }
  }
  const radius = Math.min(0.45 * spacing, 0.6);
  return ms.map((m) => {
    let rim = Infinity;
    for (let k = 0; k < samples; k++) {
      const a = (2 * Math.PI * k) / samples;
      rim = Math.min(rim, potential(sys, m.x + radius * Math.cos(a), m.y + radius * Math.sin(a)));
    }
    // Inside the disc the potential must dip below the rim, or there is no well.
    const hasWell = potential(sys, m.x, m.y) < rim;
    return { x: m.x, y: m.y, radius, rim, hasWell };
  });
}

export function trappedBy(sys, s) {
  const e = energy(sys, s);
  for (let i = 0; i < sys.traps.length; i++) {
    const t = sys.traps[i];
    if (!t.hasWell || e >= t.rim) continue;
    const dx = s.x - t.x;
    const dy = s.y - t.y;
    if (dx * dx + dy * dy < t.radius * t.radius) return i;
  }
  return -1;
}

// Release the bob at rest from (x, y) and follow it until a magnet traps it.
// Returns the magnet's index (or -1 if none did by maxTime) and the time taken.
export function fate(sys, x, y, vx = 0, vy = 0) {
  const s = { x, y, vx, vy };
  const steps = Math.ceil(sys.maxTime / sys.dt);
  for (let n = 0; n <= steps; n++) {
    const i = trappedBy(sys, s);
    if (i >= 0) return { magnet: i, time: n * sys.dt };
    step(sys, s);
  }
  return { magnet: -1, time: sys.maxTime };
}
