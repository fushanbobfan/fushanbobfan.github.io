// A month or two of tides with the real Moon and Sun: the daily range of the
// equilibrium tide as the two line up and cross, and as the Moon swings
// between perigee and apogee.

import { moonPosition, sunPosition, separation, wrap180, centuries } from './ephemeris.js';
import { moon, sun, tideAmplitude, heightFromBody } from './tides.js';

const AU = 1.495978707e11;
const RAD = Math.PI / 180;

// Elongation of the Moon from the Sun (degrees, 0-180), distances in metres.
export function sky(jde) {
  const m = moonPosition(jde);
  const s = sunPosition(jde);
  return {
    elongation: separation(m.lon, m.lat, s.lon, 0),
    moonDistance: m.dist * 1000,
    sunDistance: s.dist * AU,
    moonLon: m.lon,
    sunLon: s.lon,
  };
}

// Ecliptic longitude and latitude (degrees) to right ascension and
// declination, with the mean obliquity of the ecliptic (Meeus 13.3, 13.4, 22.2).
export function toEquatorial(lon, lat, jde) {
  const T = centuries(jde);
  const eps = (23.4392911 - 0.0130042 * T) * RAD;
  const l = lon * RAD;
  const b = lat * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l));
  return { ra: ((ra / RAD) % 360 + 360) % 360, dec: dec / RAD };
}

// Right ascension and declination (degrees) and distance (m) of the Moon and the Sun.
export function equatorialSky(jde) {
  const m = moonPosition(jde);
  const s = sunPosition(jde);
  const me = toEquatorial(m.lon, m.lat, jde);
  const se = toEquatorial(s.lon, 0, jde);
  return {
    moon: { ra: me.ra, dec: me.dec, distance: m.dist * 1000 },
    sun: { ra: se.ra, dec: se.dec, distance: s.dist * AU },
  };
}

// Range (m) from low to high water when the two tides combine with the Moon
// and Sun `elongation` degrees apart, both in the drawing plane. Two waves of
// the form a(3cos^2 - 1)/2 add to one of range 1.5 sqrt(A^2 + B^2 + 2AB cos 2e).
export function combinedRange(A, B, elongation) {
  return 1.5 * Math.sqrt(A * A + B * B + 2 * A * B * Math.cos(2 * elongation * RAD));
}

export function rangeAt(jde) {
  const k = sky(jde);
  const A = tideAmplitude(moon(0, k.moonDistance));
  const B = tideAmplitude(sun(0, k.sunDistance));
  return { jde, range: combinedRange(A, B, k.elongation), ...k };
}

export function sampleRange(start, days, step = 0.25) {
  const out = [];
  for (let t = 0; t <= days + 1e-9; t += step) out.push(rangeAt(start + t));
  return out;
}

// Golden-section search for an extreme of f on [a, b].
function refine(f, a, b, sign) {
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = b - g * (b - a);
  let x2 = a + g * (b - a);
  let f1 = sign * f(x1);
  let f2 = sign * f(x2);
  for (let i = 0; i < 60 && b - a > 1e-6; i += 1) {
    if (f1 < f2) {
      b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = sign * f(x1);
    } else {
      a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = sign * f(x2);
    }
  }
  return (a + b) / 2;
}

// Times of local minima (sign +1) or maxima (sign -1) of f in [start, end].
function extrema(f, start, end, sign, step = 0.5) {
  const out = [];
  let a = sign * f(start - step);
  let b = sign * f(start);
  for (let t = start; t <= end; t += step) {
    const c = sign * f(t + step);
    if (b <= a && b < c) out.push(refine(f, t - step, t + step, sign));
    a = b;
    b = c;
  }
  return out.filter((t) => t >= start && t <= end);
}

const dist = (t) => moonPosition(t).dist;

// Moon's ecliptic longitude minus the Sun's, folded into (-180, 180]. New moon
// is where it passes 0 and full moon where it passes 180 (USNO's definition).
export const phaseAngle = (t) => wrap180(moonPosition(t).lon - sunPosition(t).lon);

function bisect(f, a, b) {
  let fa = f(a);
  for (let i = 0; i < 50 && b - a > 1e-7; i += 1) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else { b = m; }
  }
  return (a + b) / 2;
}

// Times in [start, end] where the phase angle passes `target` degrees going up.
function phaseTimes(start, end, target) {
  const g = (t) => Math.sin((phaseAngle(t) - target) * RAD);
  const near = (t) => Math.cos((phaseAngle(t) - target) * RAD) > 0;
  const out = [];
  const step = 0.5;
  for (let t = start; t < end; t += step) {
    const a = g(t);
    const b = g(t + step);
    if (a < 0 && b >= 0 && near(t + step)) out.push(bisect(g, t, t + step));
  }
  return out;
}

// New and full moons, perigees and apogees in [start, end] (JDE).
export function events(start, end) {
  const list = [];
  for (const t of phaseTimes(start, end, 0)) list.push({ kind: 'new', jde: t });
  for (const t of phaseTimes(start, end, 180)) list.push({ kind: 'full', jde: t });
  for (const t of extrema(dist, start, end, 1)) list.push({ kind: 'perigee', jde: t, km: dist(t) });
  for (const t of extrema(dist, start, end, -1)) list.push({ kind: 'apogee', jde: t, km: dist(t) });
  return list.sort((x, y) => x.jde - y.jde);
}

// A spring tide within this many days of perigee is a perigean spring tide,
// the "king tide" of tide tables.
export const PERIGEAN_WINDOW = 1.5;

export function kingTides(evts) {
  const perigees = evts.filter((e) => e.kind === 'perigee');
  return evts
    .filter((e) => e.kind === 'new' || e.kind === 'full')
    .map((e) => {
      const p = perigees.reduce((best, q) => (Math.abs(q.jde - e.jde) < Math.abs(best.jde - e.jde) ? q : best), { jde: Infinity });
      return { ...e, perigee: p.jde === Infinity ? null : p, gap: Math.abs(p.jde - e.jde) };
    })
    .filter((e) => e.gap <= PERIGEAN_WINDOW);
}

export { heightFromBody };
