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

// Angular acceleration of the tilt; at a release with no nodding speed its
// sign says whether the top first sinks (positive) or rises (negative).
export function thetaAccel(theta, c) {
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
// The turn integrand peaks sharply when the nod passes close to upright, so
// it is integrated adaptively, with 1 - u and b - a u written so that they
// keep their precision there.
export function nodding(c, tp = turningPoints(c)) {
  const m = 0.5 * (tp.uLow + tp.uHigh);
  const h = 0.5 * (tp.uHigh - tp.uLow);
  const gapTop = 1 - tp.uHigh;
  const uAt = (s) => m + h * Math.sin(s);
  const dt = (s) => 1 / Math.sqrt(c.beta * (tp.u3 - uAt(s)));
  const dphi = (s) => {
    const q = Math.sin(Math.PI / 4 - s / 2);
    const oneMinusU = gapTop + 2 * h * q * q;
    return (dt(s) * ((c.b - c.a) + c.a * oneMinusU)) / (oneMinusU * (2 - oneMinusU));
  };
  const span = [-Math.PI / 2, Math.PI / 2];
  const period = 2 * integrate(dt, ...span, 1e-12);
  const turn = 2 * integrate(dphi, ...span, 1e-9);
  return { period, turn, precessionRate: turn / period };
}

// Adaptive Simpson's rule to a tolerance relative to the integral's size,
// judged from a first pass on 64 panels. Depth and the number of evaluations
// are capped so that rounding noise cannot keep it subdividing.
export function integrate(f, a, b, relTol, maxEvals = 200000) {
  let evals = 0;
  const F = (x) => {
    evals++;
    return f(x);
  };
  const simpson = (a, fa, b, fb) => {
    const m = 0.5 * (a + b);
    const fm = F(m);
    return { m, fm, S: ((b - a) / 6) * (fa + 4 * fm + fb) };
  };
  const n = 64;
  const panels = [];
  let rough = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + ((b - a) * i) / n;
    const x1 = a + ((b - a) * (i + 1)) / n;
    const f0 = i ? panels[i - 1].f1 : F(x0);
    const f1 = F(x1);
    const whole = simpson(x0, f0, x1, f1);
    panels.push({ x0, x1, f0, f1, whole });
    rough += Math.abs(whole.S);
  }
  const tol = relTol * rough + 1e-300;
  const recurse = (a, fa, b, fb, whole, tol, depth) => {
    const left = simpson(a, fa, whole.m, whole.fm);
    const right = simpson(whole.m, whole.fm, b, fb);
    const diff = left.S + right.S - whole.S;
    if (depth <= 0 || evals > maxEvals || Math.abs(diff) <= 15 * tol) return left.S + right.S + diff / 15;
    return (
      recurse(a, fa, whole.m, whole.fm, left, tol / 2, depth - 1) +
      recurse(whole.m, whole.fm, b, fb, right, tol / 2, depth - 1)
    );
  };
  let total = 0;
  for (const p of panels) total += recurse(p.x0, p.f0, p.x1, p.f1, p.whole, tol / n, 34);
  return total;
}

// Axes of the body: e3 along the axle, leaning towards phi; e1 and e2 turn
// with the body through psi.
export function bodyAxes(theta, phi, psi) {
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const e3 = [st * Math.cos(phi), st * Math.sin(phi), ct];
  const n = [-Math.sin(phi), Math.cos(phi), 0];
  const m = cross(e3, n);
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  return {
    e1: n.map((v, i) => c * v + s * m[i]),
    e2: n.map((v, i) => -s * v + c * m[i]),
    e3,
  };
}

const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
function cross(p, q) {
  return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
}

// The same motion integrated as vectors: angular momentum L about the tip and
// two body axes. Unlike the Euler angles, nothing here is singular when the
// axle passes through upright, so the animation uses this form.
export function bodyState(release, top = TOY) {
  const { theta, phiDot, omega3 } = release;
  const thetaDot = release.thetaDot || 0;
  const { e1, e3 } = bodyAxes(theta, 0, 0);
  const node = [0, 1, 0];
  const L = [0, 1, 2].map(
    (i) => top.I1 * phiDot * ((i === 2 ? 1 : 0) - Math.cos(theta) * e3[i]) + top.I1 * thetaDot * node[i] + top.I3 * omega3 * e3[i],
  );
  return { t: 0, L, e1, e3 };
}

// `friction` is a steady couple at the tip, in N m, acting against the spin
// about the axle: dry friction, which slows a top at a roughly constant rate.
// It stops acting once the spin is used up.
function bodyDeriv(L, e1, e3, top, friction) {
  const l3 = dot(L, e3);
  const w = L.map((v, i) => v / top.I1 + (1 / top.I3 - 1 / top.I1) * l3 * e3[i]);
  const gravity = cross(e3, [0, 0, -top.mgl]);
  const couple = l3 > 0 ? friction : 0;
  return [gravity.map((v, i) => v - couple * e3[i]), cross(w, e1), cross(w, e3)];
}

export function bodyStep(st, h, top = TOY, friction = 0) {
  const at = (k, f) => [0, 1, 2].map((j) => [st.L, st.e1, st.e3][j].map((v, i) => v + f * k[j][i]));
  const k1 = bodyDeriv(st.L, st.e1, st.e3, top, friction);
  const k2 = bodyDeriv(...at(k1, h / 2), top, friction);
  const k3 = bodyDeriv(...at(k2, h / 2), top, friction);
  const k4 = bodyDeriv(...at(k3, h), top, friction);
  const next = [st.L, st.e1, st.e3].map((x, j) => x.map((v, i) => v + (h / 6) * (k1[j][i] + 2 * k2[j][i] + 2 * k3[j][i] + k4[j][i])));
  const [Lraw, e1raw, e3raw] = next;
  const n3 = Math.hypot(...e3raw);
  const e3 = e3raw.map((v) => v / n3);
  // Friction can only stop the spin: a step that would carry it past zero
  // ends with no spin about the axle, keeping the rest of L.
  const l3 = dot(Lraw, e3);
  const L = friction > 0 && l3 < 0 && dot(st.L, st.e3) >= 0 ? Lraw.map((v, i) => v - l3 * e3[i]) : Lraw;
  const p = dot(e1raw, e3);
  const e1o = e1raw.map((v, i) => v - p * e3[i]);
  const n1 = Math.hypot(...e1o);
  return { t: st.t + h, L, e1: e1o.map((v) => v / n1), e3 };
}

// Fixed quantities of the frictionless motion through the current state, in
// the same form as constants(): with friction on they drift, and the energy
// picture is redrawn from them.
export function constantsFromBody(st, top = TOY) {
  const l3 = dot(st.L, st.e3);
  const L2 = dot(st.L, st.L);
  const beta = (2 * top.mgl) / top.I1;
  return {
    a: l3 / top.I1,
    b: st.L[2] / top.I1,
    beta,
    alpha: (L2 - l3 * l3) / (top.I1 * top.I1) + beta * st.e3[2],
    omega3: l3 / top.I3,
    u0: Math.max(-1, Math.min(1, st.e3[2])),
    top,
  };
}

// Spin about the axle, in rad/s.
export function bodySpin(st, top = TOY) {
  return dot(st.L, st.e3) / top.I3;
}

export function bodyTilt(st) {
  return Math.acos(Math.max(-1, Math.min(1, st.e3[2])));
}

// Kinetic plus potential energy of the vector state, in joules.
export function bodyEnergy(st, top = TOY) {
  const l3 = dot(st.L, st.e3);
  const L2 = dot(st.L, st.L);
  return 0.5 * ((L2 - l3 * l3) / top.I1 + (l3 * l3) / top.I3) + top.mgl * st.e3[2];
}

// A step that keeps every rotation per step small: the fastest the body can
// turn is bounded by its energy, since |omega|^2 <= 2 KE / min(I1, I3).
export function bodyStepSize(st, top = TOY) {
  const ke = bodyEnergy(st, top) + top.mgl;
  const wmax = Math.sqrt((2 * ke) / Math.min(top.I1, top.I3));
  return Math.min(2e-4, 0.03 / wmax);
}
