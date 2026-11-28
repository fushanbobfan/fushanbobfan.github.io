// The heavy symmetric top with its tip held in place, in Euler angles:
// theta is the tilt of the axle from the vertical, phi the direction it
// leans towards (precession) and psi the turn of the body about its axle.
// Two quantities stay fixed while it moves: the spin about the axle and the
// angular momentum about the vertical. Working per unit I1 they are
//   a = I3 * omega3 / I1    and    b = phiDot * sin^2(theta) + a * cos(theta).

export const G = 9.81;

// A toy top: a thin disc 3 cm in radius, 4 cm up a light stalk from the tip.
export function makeTop({ mass = 0.1, radius = 0.03, height = 0.04 } = {}) {
  const I3 = 0.5 * mass * radius * radius;
  const I1 = 0.25 * mass * radius * radius + mass * height * height;
  return { mass, radius, height, I1, I3, mgl: mass * G * height };
}

export const TOY = makeTop();

export const rpmToRad = (rpm) => (rpm * 2 * Math.PI) / 60;
export const radToRpm = (w) => (w * 60) / (2 * Math.PI);

// Tilt at which the rim of the disc touches the table.
export function floorAngle(top = TOY) {
  return Math.atan2(top.height, top.radius);
}

// Spin needed for the top to stay standing straight up ("sleeping").
export function criticalSpin(top = TOY) {
  return (2 * Math.sqrt(top.I1 * top.mgl)) / top.I3;
}

// Precession rates that keep the tilt exactly constant:
//   I1 cos(theta) W^2 - I3 omega3 W + m g l = 0.
// Returns null when the spin is too slow for any steady precession.
export function steadyPrecession(theta, omega3, top = TOY) {
  const L3 = top.I3 * omega3;
  const c = Math.cos(theta);
  if (Math.abs(c) < 1e-12) return { slow: top.mgl / L3, fast: Infinity };
  const disc = L3 * L3 - 4 * top.I1 * top.mgl * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return { slow: (2 * top.mgl) / (L3 + root), fast: (L3 + root) / (2 * top.I1 * c) };
}

// Fixed quantities of the motion that starts from a given release.
export function constants({ theta, thetaDot = 0, phiDot, omega3 }, top = TOY) {
  const a = (top.I3 * omega3) / top.I1;
  const s = Math.sin(theta);
  const u = Math.cos(theta);
  const beta = (2 * top.mgl) / top.I1;
  return {
    a,
    b: phiDot * s * s + a * u,
    beta,
    alpha: thetaDot * thetaDot + phiDot * phiDot * s * s + beta * u,
    omega3,
    u0: u,
    top,
  };
}

export function rates(theta, c) {
  const s = Math.sin(theta);
  const u = Math.cos(theta);
  const phiDot = (c.b - c.a * u) / (s * s);
  return { phiDot, psiDot: c.omega3 - phiDot * u };
}

function thetaAccel(theta, c) {
  const s = Math.sin(theta);
  const u = Math.cos(theta);
  const phiDot = (c.b - c.a * u) / (s * s);
  return phiDot * phiDot * s * u - c.a * phiDot * s + 0.5 * c.beta * s;
}

function deriv(st, c) {
  const { phiDot, psiDot } = rates(st.theta, c);
  return [st.thetaDot, thetaAccel(st.theta, c), phiDot, psiDot];
}

// One fourth-order Runge-Kutta step of length h.
export function step(st, c, h) {
  const add = (k, f) => ({
    theta: st.theta + f * k[0],
    thetaDot: st.thetaDot + f * k[1],
    phi: st.phi + f * k[2],
    psi: st.psi + f * k[3],
  });
  const k1 = deriv(st, c);
  const k2 = deriv(add(k1, h / 2), c);
  const k3 = deriv(add(k2, h / 2), c);
  const k4 = deriv(add(k3, h), c);
  const mix = (i) => (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6;
  return {
    t: st.t + h,
    theta: st.theta + h * mix(0),
    thetaDot: st.thetaDot + h * mix(1),
    phi: st.phi + h * mix(2),
    psi: st.psi + h * mix(3),
  };
}

export function initialState(release) {
  return { t: 0, theta: release.theta, thetaDot: release.thetaDot || 0, phi: 0, psi: 0 };
}

// Energy left once the spin's own share is taken away, per unit I1; constant.
export function energy(st, c) {
  const s = Math.sin(st.theta);
  const u = Math.cos(st.theta);
  const g = c.b - c.a * u;
  return 0.5 * st.thetaDot * st.thetaDot + (0.5 * g * g) / (s * s) + 0.5 * c.beta * u;
}

// Effective potential for the tilt alone, in joules: what the nodding motion
// has to climb. The tilt can only reach angles where this is below the energy.
export function effectivePotential(theta, c) {
  const s = Math.sin(theta);
  const g = c.b - c.a * Math.cos(theta);
  return c.top.I1 * ((0.5 * g * g) / (s * s) + 0.5 * c.beta * Math.cos(theta));
}

export function energyJoules(c) {
  return 0.5 * c.top.I1 * c.alpha;
}

// With u = cos(theta): u'^2 = f(u) = (1 - u^2)(alpha - beta u) - (b - a u)^2.
export function fOfU(u, c) {
  const g = c.b - c.a * u;
  return (1 - u * u) * (c.alpha - c.beta * u) - g * g;
}

// Bisection for the edge of the allowed band between `inside` (counted as
// allowed without evaluating f, so rounding at the release cannot lose it)
// and `outside`, where f < 0.
function edge(c, inside, outside) {
  for (let i = 0; i < 200 && Math.abs(outside - inside) > 1e-15; i++) {
    const mid = 0.5 * (inside + outside);
    if (fOfU(mid, c) >= 0) inside = mid;
    else outside = mid;
  }
  return inside;
}

// The two tilts between which the axle nods. f is negative at u = -1 and
// u = 1 and not negative at the release, so one root lies on each side; the
// cubic's third root is above 1.
export function turningPoints(c) {
  const uLow = edge(c, c.u0, -1);
  const uHigh = edge(c, c.u0, 1);
  const u3 = (c.alpha + c.a * c.a) / c.beta - uLow - uHigh;
  return {
    uLow,
    uHigh,
    u3,
    thetaMax: Math.acos(uLow),
    thetaMin: Math.acos(uHigh),
  };
}

// The shape the tip of the axle draws, decided by the precession rate
// b - a u at the two ends of the nod: same sign, waves; zero at one end,
// cusps; opposite signs, loops.
export function classify(c, tp = turningPoints(c)) {
  const scale = Math.abs(c.a) + Math.abs(c.b) + 1e-300;
  if (tp.uHigh - tp.uLow < 1e-6) return 'steady';
  const g1 = (c.b - c.a * tp.uLow) / scale;
  const g2 = (c.b - c.a * tp.uHigh) / scale;
  if (Math.abs(g1) < 1e-9 || Math.abs(g2) < 1e-9) return 'cusps';
  return g1 * g2 < 0 ? 'loops' : 'waves';
}

// Period of one nod and the turn in phi it carries, from
//   dt = du / sqrt(f(u))   and   dphi = (b - a u) / (1 - u^2) dt,
// with u = m + h sin(s), which turns f = beta (u - uLow)(uHigh - u)(u3 - u)
// into a smooth integrand.
export function nodding(c, tp = turningPoints(c), n = 256) {
  const m = 0.5 * (tp.uLow + tp.uHigh);
  const h = 0.5 * (tp.uHigh - tp.uLow);
  let T = 0;
  let P = 0;
  for (let i = 0; i <= n; i++) {
    const s = -Math.PI / 2 + (Math.PI * i) / n;
    const u = m + h * Math.sin(s);
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    const dt = 1 / Math.sqrt(c.beta * (tp.u3 - u));
    T += w * dt;
    P += w * dt * ((c.b - c.a * u) / (1 - u * u));
  }
  const ds = Math.PI / n / 3;
  const period = 2 * T * ds;
  const turn = 2 * P * ds;
  return { period, turn, precessionRate: turn / period };
}
