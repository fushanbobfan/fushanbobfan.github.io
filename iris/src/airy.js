// The Airy function Ai and Airy's theory of the rainbow.
//
// Ai(x) comes from its Maclaurin series on [-5, 5], from the asymptotic
// series above 5, and below -5 from a table built by integrating
// Ai'' = x Ai with fourth-order Runge-Kutta, which is stable on the
// oscillating side, and read back by cubic Hermite interpolation.

const AI0 = 0.355028053887817239;
const AIP0 = -0.258819403792806798;

function series(x) {
  const x3 = x * x * x;
  let f = 0;
  let t = 1;
  let g = 0;
  let u = x;
  for (let k = 0; k < 80; k++) {
    f += t;
    g += u;
    t *= x3 / ((3 * k + 2) * (3 * k + 3));
    u *= x3 / ((3 * k + 3) * (3 * k + 4));
    if (Math.abs(t) + Math.abs(u) < 1e-18) break;
  }
  return AI0 * f + AIP0 * g;
}

function asymptoticRight(x) {
  const z = (2 / 3) * x ** 1.5;
  const sum = 1 - 0.0694444444 / z + 0.0371334877 / (z * z) - 0.0379930001 / (z * z * z);
  return (Math.exp(-z) / (2 * Math.sqrt(Math.PI) * x ** 0.25)) * sum;
}

const STEP = 0.001;
const LEFT = -5;
const FAR = -120;
const [TABLE, SLOPE] = (() => {
  const n = Math.round((LEFT - FAR) / STEP);
  const out = new Float64Array(n + 1);
  const slope = new Float64Array(n + 1);
  let x = LEFT;
  let y = series(x);
  let dy = (series(x + 1e-5) - series(x - 1e-5)) / 2e-5;
  out[0] = y;
  slope[0] = dy;
  const h = -STEP;
  for (let i = 1; i <= n; i++) {
    const k1y = dy;
    const k1d = x * y;
    const k2y = dy + (h / 2) * k1d;
    const k2d = (x + h / 2) * (y + (h / 2) * k1y);
    const k3y = dy + (h / 2) * k2d;
    const k3d = (x + h / 2) * (y + (h / 2) * k2y);
    const k4y = dy + h * k3d;
    const k4d = (x + h) * (y + h * k3y);
    y += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    dy += (h / 6) * (k1d + 2 * k2d + 2 * k3d + k4d);
    x += h;
    out[i] = y;
    slope[i] = dy;
  }
  return [out, slope];
})();

export function airyAi(x) {
  if (x > 5) return asymptoticRight(x);
  if (x >= LEFT) return series(x);
  if (x <= FAR) {
    const z = -x;
    return Math.sin((2 / 3) * z ** 1.5 + Math.PI / 4) / (Math.sqrt(Math.PI) * z ** 0.25);
  }
  // Cubic Hermite between table points, using the stored slopes; the table
  // runs toward negative x, so slopes enter with a minus sign.
  const p = (LEFT - x) / STEP;
  const i = Math.min(TABLE.length - 2, Math.floor(p));
  const t = p - i;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * TABLE[i] - (t3 - 2 * t2 + t) * STEP * SLOPE[i]
    + (-2 * t3 + 3 * t2) * TABLE[i + 1] - (t3 - t2) * STEP * SLOPE[i + 1];
}

// Near a bow the exit wavefront is a cubic. With the deviation curving as
// α(x) ≈ α_R - α''(x - x_R)² / 2 in the impact parameter x, a drop of
// radius a tilts its wavefront by -C u² at distance u from the rainbow ray,
// with C = α'' / (2a²). The far field is then an Airy function of s ε, where
// ε is the angle from the geometric bow toward its dark side and
// s = (k² / C)^(1/3) with k the wavenumber.
export function airyScale(curvature, radius, lambdaNm) {
  const k = (2 * Math.PI) / (lambdaNm * 1e-9);
  const C = curvature / (2 * radius * radius);
  return Math.cbrt((k * k) / C);
}

// The wave intensity relative to the geometric caustic K / sqrt(-ε): over
// its fringes it averages to 1 / sqrt(-ε) on the bright side, and it falls
// off smoothly on the dark side instead of stopping.
export function airyFactor(eps, s) {
  const a = airyAi(s * eps);
  return 2 * Math.PI * Math.sqrt(s) * a * a;
}

// Where the maxima of Ai² lie: the zeros of Ai'. The first is the main bow,
// the rest are the supernumeraries.
export const AIRY_PEAKS = [-1.018792972, -3.248197582, -4.820099211, -6.163307356];
