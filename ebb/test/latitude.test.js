import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cosZenith, heightFrom, heightAtPlace, placeSeries, turningPoints, secondHighLimit, highWaterPair, describeDay,
} from '../src/latitude.js';
import { heightOnEquator } from '../src/monthchart.js';
import { equatorialSky } from '../src/month.js';
import { heightFromBody, tideAmplitude, moon } from '../src/tides.js';
import { julianDay } from '../src/time.js';

const near = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const A = tideAmplitude(moon());

test('on the equator with the Moon on the equator, the formula is the plane one', () => {
  for (const H of [0, 30, 90, 145, 180]) near(heightFrom(A, 0, 0, H), heightFromBody(H * Math.PI / 180, moon()), 1e-12);
  near(cosZenith(90, 23, 77), Math.sin(23 * Math.PI / 180), 1e-12, 'pole sees the declination');
});

test('a tilted bulge makes the two high waters unequal away from the equator', () => {
  const p = highWaterPair(A, 40, 25);
  assert.ok(p.near > p.far + 0.1, `near ${p.near} far ${p.far}`);
  const eq = highWaterPair(A, 0, 25);
  near(eq.near, eq.far, 1e-12, 'equator sees equal highs');
  const south = highWaterPair(A, -40, 25);
  near(south.near, p.far, 1e-12, 'southern hemisphere mirrors');
});

test('the second high water exists only within 90 degrees minus the declination', () => {
  near(secondHighLimit(28.5), 61.5, 1e-12);
  const highsPerDay = (lat, dec) => {
    const s = [];
    for (let H = -90; H <= 630; H += 1) s.push({ jde: H, h: heightFrom(A, lat, dec, H) });
    return turningPoints(s).highs.length / 2;
  };
  assert.equal(highsPerDay(0, 28), 2);
  assert.equal(highsPerDay(55, 28), 2);
  assert.equal(highsPerDay(65, 28), 1);
  assert.equal(highsPerDay(85, 10), 1);
  assert.equal(highsPerDay(75, 10), 2);
});

test('with the real sky, the equator of this model matches the equatorial chart closely', () => {
  // The chart puts the Moon and Sun on the equator; the full formula differs
  // only through their declinations.
  const t = julianDay(2026, 3, 20.5);
  const k = equatorialSky(t);
  assert.ok(Math.abs(k.sun.dec) < 0.5, 'equinox Sun on the equator');
  const diff = Math.abs(heightAtPlace(t, 0, 0) - heightOnEquator(t, 0));
  assert.ok(diff < 0.2, `difference ${diff}`);
});

test('two days at 45 degrees north show the inequality when the Moon is far north', () => {
  // Find a moment in Jan 2026 when the Moon is near its greatest northern declination.
  let best = null;
  for (let t = julianDay(2026, 1, 1); t < julianDay(2026, 1, 29); t += 0.25) {
    const d = equatorialSky(t).moon.dec;
    if (!best || d > best.d) best = { t, d };
  }
  assert.ok(best.d > 26, `declination ${best.d}`);
  const day = describeDay(placeSeries(best.t, 50, 45));
  assert.ok(day.perDay > 1.8 && day.perDay < 2.05, `${day.perDay} highs a day`);
  assert.ok(day.higher.h - day.lower.h > 0.12, `inequality ${day.higher.h - day.lower.h}`);
  const equator = describeDay(placeSeries(best.t, 50, 0));
  const ineq = equator.higher.h - equator.lower.h;
  assert.ok(ineq < 0.08, `equator inequality ${ineq}`);
  const far = describeDay(placeSeries(best.t, 50, 70));
  assert.ok(far.perDay < 1.1, `${far.perDay} highs a day at 70 N`);
});

test('turning points are refined between samples', () => {
  const s = [];
  for (let i = 0; i <= 40; i += 1) s.push({ jde: i / 10, h: -((i / 10 - 1.234) ** 2) });
  const { highs } = turningPoints(s);
  assert.equal(highs.length, 1);
  near(highs[0].jde, 1.234, 1e-9);
  near(highs[0].h, 0, 1e-12);
});

test('the side view puts the place on the bulges at the heights the formula gives', async () => {
  const { renderSide, renderDay } = await import('../src/sideview.js');
  const side = renderSide({ dec: 25, lat: 40, amp: A });
  const pair = highWaterPair(A, 40, 25);
  near(side.nearH, pair.near, 1e-12);
  near(side.farH, pair.far, 1e-12);
  assert.ok(!side.svg.includes('NaN'));
  assert.ok(side.svg.includes(`+${Math.round(pair.near * 100)} cm`));
  const series = placeSeries(julianDay(2026, 1, 10), 50, 45);
  const { highs, lows } = turningPoints(series);
  const day = renderDay({ series, highs, lows });
  assert.equal((day.match(/class="hw"/g) || []).length, highs.length);
  assert.equal((day.match(/class="lw"/g) || []).length, lows.length);
  assert.ok(!day.includes('NaN'));
});

test('high waters per tidal day follow the declination limit with the real sky', async () => {
  const { highWatersPerDay, relativeToMean } = await import('../src/latitude.js');
  const t = julianDay(2026, 1, 1.5);
  const dec = equatorialSky(t).moon.dec;
  assert.ok(dec > 25);
  assert.equal(highWatersPerDay(t, 45), 2);
  assert.equal(highWatersPerDay(t, 0), 2);
  assert.equal(highWatersPerDay(t, 75), 1);
  assert.equal(relativeToMean(-0.214), '21 cm below the mean');
  assert.equal(relativeToMean(0.51), '51 cm above the mean');
});
