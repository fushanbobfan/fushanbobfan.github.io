// New and full moons, and which of them are eclipses.
//
// A new moon is a solar eclipse when the Moon passes close enough to the Sun's
// line of sight that its shadow touches the Earth; a full moon is a lunar
// eclipse when the Moon dips into the Earth's shadow. How close is close enough
// follows from the sizes and distances of the three bodies at that moment.

import { moonPosition, sunPosition, separation, wrap180, norm360 } from './ephemeris.js';

export const SYNODIC_MONTH = 29.530588861; // new moon to new moon, days
export const DRACONIC_MONTH = 27.212220817; // node to the same node, days
export const ECLIPSE_YEAR = 346.620075883; // Sun back to the same node, days
export const MOON_INCLINATION = 5.145; // degrees, mean tilt of the Moon's orbit

const EARTH_RADIUS = 6378.14; // km
const MOON_RADIUS = 1737.4; // km
const SUN_SEMIDIAMETER_1AU = 959.63 / 3600; // degrees
const SUN_PARALLAX_1AU = 8.794 / 3600; // degrees
const SHADOW_ENLARGEMENT = 1.02; // the atmosphere widens the Earth's shadow
const DEG = 180 / Math.PI;
const asinDeg = (x) => Math.asin(x) * DEG;

// Days since J2000 of new moon number k (k = 0 near 2000 January 6).
function meanNewMoon(k) {
  return 2451550.09766 + SYNODIC_MONTH * k;
}

// Moon minus Sun in longitude, folded so that the target phase sits at zero.
function elongationFrom(jde, phase) {
  return wrap180(moonPosition(jde).lon - sunPosition(jde).lon - phase);
}

function refine(jde, phase) {
  let t = jde;
  for (let i = 0; i < 8; i++) {
    const f = elongationFrom(t, phase);
    if (Math.abs(f) < 1e-7) break;
    const h = 0.01;
    const slope = (elongationFrom(t + h, phase) - elongationFrom(t - h, phase)) / (2 * h);
    t -= f / slope;
  }
  return t;
}

// Angle from the Moon's centre to the Sun's (new moon) or to the centre of the
// Earth's shadow (full moon).
// `scale` stretches the Moon's latitude, to ask what a flatter or steeper
// orbit would do.
export function axisDistance(jde, kind, scale = 1) {
  const m = moonPosition(jde);
  const s = sunPosition(jde);
  const lon = kind === 'new' ? s.lon : norm360(s.lon + 180);
  return separation(m.lon, m.lat * scale, lon, 0);
}

// Golden-section search for the moment the Moon passes closest to the axis.
function closestApproach(jde, kind, scale) {
  let a = jde - 0.25;
  let b = jde + 0.25;
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = axisDistance(c, kind, scale);
  let fd = axisDistance(d, kind, scale);
  while (b - a > 1e-5) {
    if (fc < fd) {
      b = d; d = c; fd = fc; c = b - g * (b - a); fc = axisDistance(c, kind, scale);
    } else {
      a = c; c = d; fc = fd; d = a + g * (b - a); fd = axisDistance(d, kind, scale);
    }
  }
  const t = (a + b) / 2;
  return { jde: t, gap: axisDistance(t, kind, scale) };
}

// Apparent sizes at a moment, degrees.
export function geometry(jde) {
  const m = moonPosition(jde);
  const s = sunPosition(jde);
  return {
    moonParallax: asinDeg(EARTH_RADIUS / m.dist),
    moonRadius: asinDeg(MOON_RADIUS / m.dist),
    sunParallax: SUN_PARALLAX_1AU / s.dist,
    sunRadius: SUN_SEMIDIAMETER_1AU / s.dist,
    moonDist: m.dist,
  };
}

// The largest gap between the Moon and the axis that still gives each kind of
// eclipse, for the sizes at this moment.
export function limits(g) {
  const umbra = SHADOW_ENLARGEMENT * (g.moonParallax + g.sunParallax - g.sunRadius);
  const penumbra = SHADOW_ENLARGEMENT * (g.moonParallax + g.sunParallax + g.sunRadius);
  return {
    solarPartial: g.moonParallax - g.sunParallax + g.sunRadius + g.moonRadius,
    solarCentral: g.moonParallax - g.sunParallax,
    lunarPenumbral: penumbra + g.moonRadius,
    lunarPartial: umbra + g.moonRadius,
    lunarTotal: umbra - g.moonRadius,
    umbra,
    penumbra,
  };
}

// Whether the Moon covers the whole Sun for an observer nearest the Moon on the
// central line (total) and at the edge of the Earth (where a hybrid turns annular).
function centralKind(g, gap) {
  const depth = Math.sqrt(Math.max(0, 1 - (gap / g.moonParallax) ** 2));
  const nearest = asinDeg(MOON_RADIUS / (g.moonDist - EARTH_RADIUS * depth));
  const edge = g.moonRadius;
  if (nearest < g.sunRadius) return 'annular';
  return edge < g.sunRadius ? 'hybrid' : 'total';
}

export function classify(kind, gap, g, lim = limits(g)) {
  if (kind === 'new') {
    if (gap >= lim.solarPartial) return null;
    if (gap < lim.solarCentral) return centralKind(g, gap);
    // The axis misses the Earth but the edge of the umbra or antumbra still
    // grazes it: a non-central total or annular eclipse.
    if (gap < lim.solarCentral + Math.abs(g.moonRadius - g.sunRadius)) {
      return g.moonRadius > g.sunRadius ? 'total' : 'annular';
    }
    return 'partial';
  }
  if (gap >= lim.lunarPenumbral) return null;
  if (gap < lim.lunarTotal) return 'total';
  if (gap < lim.lunarPartial) return 'partial';
  return 'penumbral';
}

// Every new and full moon whose instant falls in [startJde, endJde), with the
// Moon's ecliptic latitude at that instant and the eclipse it makes, if any.
// `tilt` replaces the Moon's real orbital tilt by scaling its latitude.
export function syzygies(startJde, endJde, { tilt = MOON_INCLINATION } = {}) {
  const scale = tilt / MOON_INCLINATION;
  const out = [];
  let k = Math.floor((startJde - 2451550.09766) / SYNODIC_MONTH) - 1;
  for (;; k++) {
    if (meanNewMoon(k) > endJde + SYNODIC_MONTH) break;
    for (const [kind, phase, offset] of [['new', 0, 0], ['full', 180, 0.5]]) {
      const t = refine(meanNewMoon(k + offset), phase);
      if (t < startJde || t >= endJde) continue;
      const near = closestApproach(t, kind, scale);
      const g = geometry(near.jde);
      const lim = limits(g);
      out.push({
        kind,
        jde: t,
        lat: moonPosition(t).lat * scale,
        greatest: near.jde,
        gap: near.gap,
        limits: lim,
        eclipse: classify(kind, near.gap, g, lim),
      });
    }
  }
  return out.sort((a, b) => a.jde - b.jde);
}

export function eclipses(startJde, endJde, options) {
  return syzygies(startJde, endJde, options).filter((s) => s.eclipse);
}
