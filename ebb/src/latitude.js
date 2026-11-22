// The tide at a latitude. The Moon and the Sun stand north or south of the
// equator (their declination), so the two bulges are tilted and a place away
// from the equator passes through one high and one low part of each bulge in
// a day: the two high waters are unequal, and far enough from the equator
// the smaller one disappears.

import { moon, sun, tideAmplitude } from './tides.js';
import { equatorialSky } from './month.js';
import { earthTurn } from './monthchart.js';
import { jdeToUtc } from './time.js';

const RAD = Math.PI / 180;

// Cosine of the angle from a body at declination `dec` to a place at latitude
// `lat`, the body `hourAngle` west of the place's meridian (all degrees).
export function cosZenith(lat, dec, hourAngle) {
  return Math.sin(lat * RAD) * Math.sin(dec * RAD)
    + Math.cos(lat * RAD) * Math.cos(dec * RAD) * Math.cos(hourAngle * RAD);
}

// Equilibrium tide height (m) from one body of tide amplitude `amp`.
export function heightFrom(amp, lat, dec, hourAngle) {
  const c = cosZenith(lat, dec, hourAngle);
  return amp * (3 * c * c - 1) / 2;
}

// Height (m) at latitude `lat`, longitude `lon` (degrees east) at time `jde`,
// with the real Moon and Sun.
export function heightAtPlace(jde, lat, lon = 0) {
  const k = equatorialSky(jde);
  const turn = earthTurn(jdeToUtc(jde)) + lon;
  return heightFrom(tideAmplitude(moon(0, k.moon.distance)), lat, k.moon.dec, turn - k.moon.ra)
    + heightFrom(tideAmplitude(sun(0, k.sun.distance)), lat, k.sun.dec, turn - k.sun.ra);
}

export function placeSeries(start, hours, lat, lon = 0, stepMinutes = 10) {
  const out = [];
  const step = stepMinutes / 1440;
  for (let t = 0; t <= hours / 24 + 1e-9; t += step) out.push({ jde: start + t, h: heightAtPlace(start + t, lat, lon) });
  return out;
}

// Local maxima (high waters) and minima (low waters) of a series, refined by
// fitting a parabola through each extreme and its neighbours.
export function turningPoints(series) {
  const highs = [];
  const lows = [];
  for (let i = 1; i < series.length - 1; i += 1) {
    const [a, b, c] = [series[i - 1], series[i], series[i + 1]];
    const isHigh = b.h > a.h && b.h >= c.h;
    const isLow = b.h < a.h && b.h <= c.h;
    if (!isHigh && !isLow) continue;
    const denom = a.h - 2 * b.h + c.h;
    const shift = denom === 0 ? 0 : (0.5 * (a.h - c.h)) / denom;
    const dt = b.jde - a.jde;
    const p = { jde: b.jde + shift * dt, h: b.h - 0.25 * (a.h - c.h) * shift };
    (isHigh ? highs : lows).push(p);
  }
  return { highs, lows };
}

// A second high water each tidal day exists only while |lat| < 90 - |dec|:
// beyond that the place never gets near the far bulge's crest.
export const secondHighLimit = (dec) => 90 - Math.abs(dec);

// Heights (m) of the two high waters of one tidal day under a single body,
// at hour angle 0 (body overhead side) and 180 (far side).
export function highWaterPair(amp, lat, dec) {
  return { near: heightFrom(amp, lat, dec, 0), far: heightFrom(amp, lat, dec, 180) };
}

// Describe a day of tide: how many high waters and how unequal they are.
export function describeDay(series) {
  const { highs, lows } = turningPoints(series);
  const days = (series[series.length - 1].jde - series[0].jde);
  const perDay = highs.length / days;
  const sorted = [...highs].sort((x, y) => y.h - x.h);
  const higher = sorted[0];
  const lower = highs.length > 1 ? sorted[sorted.length - 1] : null;
  return { highs, lows, perDay, higher, lower };
}
