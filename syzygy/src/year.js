// Everything the page shows for one calendar year.

import { moonPosition, sunPosition, wrap180 } from './ephemeris.js';
import { syzygies, MOON_INCLINATION } from './eclipses.js';
import { julianDay, utcToJde } from './time.js';

const RAD = Math.PI / 180;
export const SAMPLE_STEP = 0.25; // days between points of the latitude curve

// Angle from the Sun to the nearer end of the Moon's line of nodes, degrees.
export function sunFromNode(jde) {
  const node = moonPosition(jde).node;
  const d = wrap180(sunPosition(jde).lon - node);
  return Math.abs(d) > 90 ? wrap180(d - 180) : d;
}

// How far the Sun may stand from a node and still have a new moon close enough
// to it for an eclipse: where the tilted orbit is lower than `limit`.
export function seasonHalfWidth(limit, tilt) {
  const s = Math.sin(limit * RAD) / Math.sin(tilt * RAD);
  return tilt <= 0 || s >= 1 ? 90 : Math.asin(s) / RAD;
}

// The tilt itself swings between about 4.99° and 5.30° as the Sun pulls on the
// orbit; seasons use the low end so that no eclipse falls outside one.
const LOWEST_TILT_SHARE = 4.99 / MOON_INCLINATION;

// `step` sets how finely the season edges and the curve are sampled; the
// many-years view uses whole days.
export function buildYear(year, tilt = MOON_INCLINATION, { step = SAMPLE_STEP } = {}) {
  const start = utcToJde(julianDay(year, 1, 1));
  const end = utcToJde(julianDay(year + 1, 1, 1));
  const events = syzygies(start, end, { tilt });
  const scale = tilt / MOON_INCLINATION;

  const samples = [];
  for (let t = start; t <= end + 1e-9; t += step) {
    samples.push({ jde: t, lat: moonPosition(t).lat * scale, fromNode: sunFromNode(t) });
  }

  const widestLimit = Math.max(...events.map((e) => (e.kind === 'new' ? e.limits.solarPartial : e.limits.lunarPenumbral)));
  const halfWidth = seasonHalfWidth(widestLimit, tilt * LOWEST_TILT_SHARE);
  const seasons = [];
  let open = null;
  // Edges fall between samples: interpolate where |fromNode| crosses the width.
  const edge = (a, b) => {
    const fa = Math.abs(a.fromNode) - halfWidth;
    const fb = Math.abs(b.fromNode) - halfWidth;
    return a.jde + (b.jde - a.jde) * (fa / (fa - fb));
  };
  samples.forEach((s, i) => {
    const inside = Math.abs(s.fromNode) < halfWidth;
    if (inside && !open) open = { start: i ? edge(samples[i - 1], s) : s.jde };
    if (!inside && open) { open.end = edge(samples[i - 1], s); seasons.push(open); open = null; }
  });
  if (open) { open.end = end; seasons.push(open); }

  const found = events.filter((e) => e.eclipse);
  return {
    year,
    tilt,
    start,
    end,
    events,
    samples,
    seasons,
    halfWidth,
    widestLimit,
    eclipses: found,
    solarCount: found.filter((e) => e.kind === 'new').length,
    lunarCount: found.filter((e) => e.kind === 'full').length,
  };
}

// Where the Earth, Moon and nodes are at one instant, for the top view.
export function snapshot(jde, tilt = MOON_INCLINATION) {
  const m = moonPosition(jde);
  const s = sunPosition(jde);
  const elongation = ((m.lon - s.lon) % 360 + 360) % 360;
  return {
    jde,
    sunLon: s.lon,
    moonLon: m.lon,
    moonLat: m.lat * (tilt / MOON_INCLINATION),
    node: m.node,
    elongation,
    fromNode: sunFromNode(jde),
  };
}

const PHASES = [
  [22.5, 'new moon'], [67.5, 'waxing crescent'], [112.5, 'first quarter'],
  [157.5, 'waxing gibbous'], [202.5, 'full moon'], [247.5, 'waning gibbous'],
  [292.5, 'last quarter'], [337.5, 'waning crescent'], [360, 'new moon'],
];

export function phaseName(elongation) {
  return PHASES.find(([edge]) => elongation < edge)[1];
}
