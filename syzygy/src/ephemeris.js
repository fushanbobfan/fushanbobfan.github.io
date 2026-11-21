// Positions of the Sun and the Moon from truncated series (Meeus, Astronomical
// Algorithms, chapters 25 and 47). Angles in degrees, times as Julian
// Ephemeris Days. Good to a few hundredths of a degree for the Moon, which puts
// a new or full moon within a couple of minutes.

const RAD = Math.PI / 180;
export const J2000 = 2451545.0;

const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);

export function norm360(d) {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

// Signed difference a - b folded into (-180, 180].
export function wrap180(d) {
  const r = norm360(d);
  return r > 180 ? r - 360 : r;
}

export function centuries(jde) {
  return (jde - J2000) / 36525;
}

// Fundamental arguments of the lunar theory.
export function lunarArguments(jde) {
  const T = centuries(jde);
  return {
    T,
    Lp: norm360(218.3164477 + 481267.88123421 * T), // Moon's mean longitude
    D: norm360(297.8501921 + 445267.1114034 * T), // mean elongation from the Sun
    M: norm360(357.5291092 + 35999.0502909 * T), // Sun's mean anomaly
    Mp: norm360(134.9633964 + 477198.8675055 * T), // Moon's mean anomaly
    F: norm360(93.272095 + 483202.0175233 * T), // Moon's argument of latitude
    node: norm360(125.0445479 - 1934.1362891 * T), // ascending node of the orbit
  };
}

// [coefficient, D, M, M', F]; terms with M are scaled by E for the shrinking
// eccentricity of Earth's orbit.
const LONGITUDE = [
  [6.288774, 0, 0, 1, 0], [1.274027, 2, 0, -1, 0], [0.658314, 2, 0, 0, 0],
  [0.213618, 0, 0, 2, 0], [-0.185116, 0, 1, 0, 0], [-0.114332, 0, 0, 0, 2],
  [0.058793, 2, 0, -2, 0], [0.057066, 2, -1, -1, 0], [0.053322, 2, 0, 1, 0],
  [0.045758, 2, -1, 0, 0], [-0.040923, 0, 1, -1, 0], [-0.03472, 1, 0, 0, 0],
  [-0.030383, 0, 1, 1, 0], [0.015327, 2, 0, 0, -2], [-0.012528, 0, 0, 1, 2],
  [0.01098, 0, 0, 1, -2], [0.010675, 4, 0, -1, 0], [0.010034, 0, 0, 3, 0],
  [0.008548, 4, 0, -2, 0], [-0.007888, 2, 1, -1, 0], [-0.006766, 2, 1, 0, 0],
  [-0.005163, 1, 0, -1, 0], [0.004987, 1, 1, 0, 0], [0.004036, 2, -1, 1, 0],
  [0.003994, 2, 0, 2, 0], [0.003861, 4, 0, 0, 0], [0.003665, 2, 0, -3, 0],
  [-0.002689, 0, 1, -2, 0], [-0.002602, 2, 0, -1, 2], [0.002390, 2, -1, -2, 0],
  [-0.002348, 1, 0, 1, 0], [0.002236, 2, -2, 0, 0], [-0.00212, 0, 1, 2, 0],
  [-0.002069, 0, 2, 0, 0], [0.002048, 2, -2, -1, 0],
];

const LATITUDE = [
  [5.128122, 0, 0, 0, 1], [0.280602, 0, 0, 1, 1], [0.277693, 0, 0, 1, -1],
  [0.173237, 2, 0, 0, -1], [0.055413, 2, 0, -1, 1], [0.046271, 2, 0, -1, -1],
  [0.032573, 2, 0, 0, 1], [0.017198, 0, 0, 2, 1], [0.009266, 2, 0, 1, -1],
  [0.008822, 0, 0, 2, -1], [0.008216, 2, -1, 0, -1], [0.004324, 2, 0, -2, -1],
  [0.0042, 2, 0, 1, 1], [-0.003359, 2, 1, 0, -1], [0.002463, 2, -1, -1, 1],
  [0.002211, 2, -1, 0, 1], [0.002065, 2, -1, -1, -1], [-0.001870, 0, 1, -1, -1],
  [0.001828, 4, 0, -1, -1], [-0.001794, 0, 1, 0, 1], [-0.001749, 0, 0, 0, 3],
];

// Distance terms in kilometres, multiplying cosines.
const DISTANCE = [
  [-20905.355, 0, 0, 1, 0], [-3699.111, 2, 0, -1, 0], [-2955.968, 2, 0, 0, 0],
  [-569.925, 0, 0, 2, 0], [48.888, 0, 1, 0, 0], [-3.149, 0, 0, 0, 2],
  [246.158, 2, 0, -2, 0], [-152.138, 2, -1, -1, 0], [-170.733, 2, 0, 1, 0],
  [-204.586, 2, -1, 0, 0], [-129.62, 0, 1, -1, 0], [108.743, 1, 0, 0, 0],
  [104.755, 0, 1, 1, 0], [10.321, 2, 0, 0, -2], [79.661, 0, 0, 1, -2],
  [-34.782, 4, 0, -1, 0], [-23.21, 0, 0, 3, 0], [-21.636, 4, 0, -2, 0],
  [24.208, 2, 1, -1, 0], [30.824, 2, 1, 0, 0], [-8.379, 1, 0, -1, 0],
  [-16.675, 1, 1, 0, 0], [-12.831, 2, -1, 1, 0], [-10.445, 2, 0, 2, 0],
  [-11.65, 4, 0, 0, 0], [14.403, 2, 0, -3, 0], [-7.003, 0, 1, -2, 0],
  [10.056, 2, -1, -2, 0], [6.322, 1, 0, 1, 0], [-9.884, 2, -2, 0, 0],
];

function series(terms, a, E, fn) {
  let sum = 0;
  for (const [c, d, m, mp, f] of terms) {
    const arg = d * a.D + m * a.M + mp * a.Mp + f * a.F;
    const scale = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sum += c * scale * fn(arg);
  }
  return sum;
}

// Geocentric ecliptic longitude, latitude (degrees) and distance (km) of the Moon.
export function moonPosition(jde) {
  const a = lunarArguments(jde);
  const E = 1 - 0.002516 * a.T - 0.0000074 * a.T * a.T;
  const A1 = 119.75 + 131.849 * a.T;
  const A2 = 53.09 + 479264.29 * a.T;
  const A3 = 313.45 + 481266.484 * a.T;
  const lon = a.Lp + series(LONGITUDE, a, E, sin)
    + 0.003958 * sin(A1) + 0.001962 * sin(a.Lp - a.F) + 0.000318 * sin(A2);
  const lat = series(LATITUDE, a, E, sin)
    - 0.002235 * sin(a.Lp) + 0.000382 * sin(A3) + 0.000175 * sin(A1 - a.F)
    + 0.000175 * sin(A1 + a.F) + 0.000127 * sin(a.Lp - a.Mp) - 0.000115 * sin(a.Lp + a.Mp);
  const dist = 385000.56 + series(DISTANCE, a, E, cos);
  return { lon: norm360(lon), lat, dist, node: a.node };
}

// Geocentric ecliptic longitude of the Sun (degrees, with aberration) and its
// distance in astronomical units.
export function sunPosition(jde) {
  const T = centuries(jde);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M)
    + 0.000289 * sin(3 * M);
  const nu = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cos(nu));
  return { lon: norm360(L0 + C - 0.00569), dist: R };
}

// Angle between two points on the ecliptic sphere, degrees.
export function separation(lon1, lat1, lon2, lat2) {
  const c = sin(lat1) * sin(lat2) + cos(lat1) * cos(lat2) * cos(lon1 - lon2);
  const s = Math.hypot(
    cos(lat2) * sin(lon1 - lon2),
    cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(lon1 - lon2),
  );
  return Math.atan2(s, c) / RAD;
}
