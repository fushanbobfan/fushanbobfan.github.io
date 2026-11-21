// Everything the page shows for one calendar year.

import { moonPosition, sunPosition, wrap180 } from './ephemeris.js';
import { syzygies, MOON_INCLINATION } from './eclipses.js';
import { julianDay } from './time.js';

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

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function buildYear(year, tilt = MOON_INCLINATION) {
  const start = julianDay(year, 1, 1);
  const end = julianDay(year + 1, 1, 1);
  const events = syzygies(start, end, { tilt });
  const scale = tilt / MOON_INCLINATION;

  const samples = [];
  for (let t = start; t <= end + 1e-9; t += SAMPLE_STEP) {
    samples.push({ jde: t, lat: moonPosition(t).lat * scale, fromNode: sunFromNode(t) });
  }

  const solarLimit = mean(events.filter((e) => e.kind === 'new').map((e) => e.limits.solarPartial));
  const halfWidth = seasonHalfWidth(solarLimit, tilt);
  const seasons = [];
  let open = null;
  for (const s of samples) {
    const inside = Math.abs(s.fromNode) < halfWidth;
    if (inside && !open) open = { start: s.jde };
    if (!inside && open) { open.end = s.jde; seasons.push(open); open = null; }
  }
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
    solarLimit,
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
