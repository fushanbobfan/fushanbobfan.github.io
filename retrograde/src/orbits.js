// Planet positions from JPL's approximate Keplerian elements (Standish,
// "Keplerian Elements for Approximate Positions of the Major Planets",
// Table 1: mean ecliptic and equinox of J2000, fitted for 1800-2050).
// Each row: a (au), e, I, L, long. perihelion, long. node (degrees),
// then the rate of each per Julian century.

export const ELEMENTS = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
    0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
    0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
    0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
    0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
    -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
    -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
    -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
    0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};

export const PLANETS = Object.keys(ELEMENTS).filter((p) => p !== 'earth');
export const J2000 = 2451545.0;
export const VALID_FROM = 2378496.5; // 1800 January 1
export const VALID_TO = 2470171.5; // 2051 January 1

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export const wrap360 = (d) => ((d % 360) + 360) % 360;
export const wrap180 = (d) => wrap360(d + 180) - 180;

export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function dateOf(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

export function elementsAt(planet, jd) {
  const row = ELEMENTS[planet];
  if (!row) throw new Error(`unknown planet ${planet}`);
  const T = (jd - J2000) / 36525;
  const [a, e, I, L, peri, node] = row.slice(0, 6).map((v, i) => v + row[i + 6] * T);
  return { a, e, I, L, peri, node };
}

// Kepler's equation M = E - e sin E, M and E in radians.
export function solveKepler(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-14) break;
  }
  return E;
}

// Heliocentric ecliptic coordinates in au.
export function heliocentric(planet, jd) {
  const { a, e, I, L, peri, node } = elementsAt(planet, jd);
  const w = (peri - node) * RAD;
  const M = wrap180(L - peri) * RAD;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(node * RAD), sO = Math.sin(node * RAD);
  const cI = Math.cos(I * RAD), sI = Math.sin(I * RAD);
  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: sw * sI * xp + cw * sI * yp,
  };
}

// Where the planet stands in Earth's sky: ecliptic longitude and latitude in
// degrees and distance in au. Light time and aberration are left out; they
// shift a station by well under a day.
export function geocentric(planet, jd) {
  const p = heliocentric(planet, jd);
  const g = heliocentric('earth', jd);
  const x = p.x - g.x, y = p.y - g.y, z = p.z - g.z;
  const dist = Math.hypot(x, y, z);
  return { lon: wrap360(Math.atan2(y, x) * DEG), lat: Math.asin(z / dist) * DEG, dist, x, y, z };
}

// Angle between the planet and the Sun seen from Earth, in degrees, signed:
// positive east of the Sun (an evening sky), negative west of it.
export function elongation(planet, jd) {
  const g = heliocentric('earth', jd);
  const sun = wrap360(Math.atan2(-g.y, -g.x) * DEG);
  return wrap180(geocentric(planet, jd).lon - sun);
}

// Apparent motion along the ecliptic, degrees per day (negative: retrograde).
export function dailyMotion(planet, jd, h = 0.25) {
  return wrap180(geocentric(planet, jd + h).lon - geocentric(planet, jd - h).lon) / (2 * h);
}

export function siderealPeriod(planet) {
  return 36525 * 360 / ELEMENTS[planet][9];
}

export function synodicPeriod(planet) {
  const n = ELEMENTS[planet][9], ne = ELEMENTS.earth[9];
  return 36525 * 360 / Math.abs(n - ne);
}

// The stationary points between jd0 and jd1, where the daily motion changes
// sign. 'retrograde' begins a loop, 'direct' ends it.
export function stations(planet, jd0, jd1, step = 1) {
  const out = [];
  let ta = jd0, va = dailyMotion(planet, ta);
  for (let tb = jd0 + step; tb <= jd1 + 1e-9; tb += step) {
    const vb = dailyMotion(planet, tb);
    if ((va > 0) !== (vb > 0)) {
      let lo = ta, hi = tb, vlo = va;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2, vm = dailyMotion(planet, mid);
        if ((vm > 0) === (vlo > 0)) { lo = mid; vlo = vm; } else hi = mid;
      }
      const jd = (lo + hi) / 2;
      out.push({ jd, kind: va > 0 ? 'retrograde' : 'direct', lon: geocentric(planet, jd).lon });
    }
    ta = tb; va = vb;
  }
  return out;
}

// Retrograde loops that start and end between jd0 and jd1. Each records its
// two stations, the middle of the loop (the planet's opposition, or for
// Mercury and Venus its inferior conjunction) and the arc it backs up.
export function loops(planet, jd0, jd1) {
  const st = stations(planet, jd0, jd1);
  const out = [];
  for (let i = 0; i + 1 < st.length; i++) {
    if (st[i].kind !== 'retrograde' || st[i + 1].kind !== 'direct') continue;
    const a = st[i], b = st[i + 1];
    let mid = a.jd, best = Infinity;
    for (let t = a.jd; t <= b.jd; t += 0.25) {
      const d = Math.abs(Math.abs(elongation(planet, t)) - (inner(planet) ? 0 : 180));
      if (d < best) { best = d; mid = t; }
    }
    out.push({
      start: a.jd,
      end: b.jd,
      days: b.jd - a.jd,
      middle: mid,
      arc: wrap360(a.lon - b.lon),
      startLon: a.lon,
      endLon: b.lon,
    });
  }
  return out;
}

export function inner(planet) {
  return ELEMENTS[planet][0] < ELEMENTS.earth[0];
}

// The planet's track in a frame that keeps the Earth at the centre, n points
// from jd0 to jd1: the loops Ptolemy drew with epicycles.
export function earthCentredPath(planet, jd0, jd1, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = jd0 + (n === 1 ? 0 : (i / (n - 1)) * (jd1 - jd0));
    const g = geocentric(planet, t);
    out.push({ t, x: g.x, y: g.y, z: g.z, dist: g.dist });
  }
  return out;
}

// The date and distance of the planet's nearest approach to the Earth
// between jd0 and jd1, to within a few minutes.
export function closestApproach(planet, jd0, jd1) {
  let best = jd0, bestDist = Infinity;
  for (let t = jd0; t <= jd1; t += 0.5) {
    const d = geocentric(planet, t).dist;
    if (d < bestDist) { bestDist = d; best = t; }
  }
  let lo = Math.max(jd0, best - 0.5), hi = Math.min(jd1, best + 0.5);
  for (let i = 0; i < 40; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (geocentric(planet, m1).dist < geocentric(planet, m2).dist) hi = m2; else lo = m1;
  }
  const jd = (lo + hi) / 2;
  return { jd, dist: geocentric(planet, jd).dist };
}

// The planet's place seen from the Earth split the way Ptolemy split it: a
// centre carried round a deferent, plus an arm turning on an epicycle. For
// an outer planet the deferent is the planet's own orbit and the arm is the
// Sun-to-Earth step reversed, so it always points the way the Sun lies from
// the Earth; for Mercury and Venus the deferent carries the Sun and the arm
// is the planet's orbit around it.
export function epicycle(planet, jd) {
  const p = heliocentric(planet, jd);
  const e = heliocentric('earth', jd);
  const sun = { x: -e.x, y: -e.y, z: -e.z };
  const centre = inner(planet) ? sun : { x: p.x, y: p.y, z: p.z };
  const arm = inner(planet) ? p : sun;
  return {
    centre,
    arm,
    deferent: Math.hypot(centre.x, centre.y),
    radius: Math.hypot(arm.x, arm.y),
  };
}
