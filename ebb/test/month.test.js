import { test } from 'node:test';
import assert from 'node:assert/strict';
import { events, kingTides, combinedRange, rangeAt, sampleRange } from '../src/month.js';
import { renderMonth, heightOnEquator, earthTurn, eventLabel } from '../src/monthchart.js';
import { moonPosition } from '../src/ephemeris.js';
import { julianDay, jdeToUtc } from '../src/time.js';
import { tideAmplitude, moon, sun } from '../src/tides.js';

// Perigees of 2026 from Fred Espenak's table (astropixels.com,
// ephemeris/moon/moonperap2001.html): date, time (GMT) and distance in km.
const ESPENAK_2026 = [
  [1, 1, 21, 43, 360348], [1, 29, 21, 53, 365878], [2, 24, 23, 18, 370132], [3, 22, 11, 40, 366858],
  [4, 19, 6, 57, 361631], [5, 17, 13, 48, 358074], [6, 14, 23, 18, 357196], [7, 13, 7, 50, 359111],
  [8, 10, 11, 18, 363288], [9, 6, 20, 26, 368255], [10, 1, 20, 41, 369338], [10, 28, 18, 1, 364411],
  [11, 25, 20, 58, 359348], [12, 24, 8, 30, 356650],
];

const year = events(julianDay(2026, 1, 1), julianDay(2027, 1, 1));

test('every 2026 perigee falls within 20 minutes and 40 km of the published table', () => {
  const perigees = year.filter((e) => e.kind === 'perigee');
  assert.equal(perigees.length, ESPENAK_2026.length);
  ESPENAK_2026.forEach(([m, d, h, min, km], i) => {
    const want = julianDay(2026, m, d + (h + min / 60) / 24);
    const got = jdeToUtc(perigees[i].jde);
    assert.ok(Math.abs(got - want) * 1440 < 20, `perigee ${m}/${d} off by ${((got - want) * 1440).toFixed(0)} min`);
    assert.ok(Math.abs(perigees[i].km - km) < 40, `perigee ${m}/${d}: ${perigees[i].km} km vs ${km}`);
  });
});

test('the Moon\'s distance is within 25 km of Meeus\'s worked example', () => {
  // Astronomical Algorithms, example 47.a: 1992 April 12, 0h TD, 368,409.7 km
  // from the full series; the truncated series here lands about 19 km out.
  assert.ok(Math.abs(moonPosition(2448724.5).dist - 368409.7) < 25);
});

test('a year holds about 12.4 new moons, 12.4 full moons and 13.3 perigees', () => {
  const n = (k) => year.filter((e) => e.kind === k).length;
  assert.ok(n('new') >= 12 && n('new') <= 13);
  assert.ok(n('full') >= 12 && n('full') <= 13);
  assert.ok(n('apogee') >= 13 && n('apogee') <= 14);
  const news = year.filter((e) => e.kind === 'new').map((e) => e.jde);
  for (let i = 1; i < news.length; i += 1) {
    const gap = news[i] - news[i - 1];
    assert.ok(gap > 29.2 && gap < 29.9, `lunation of ${gap} days`);
  }
});

test('2026 has perigean spring tides around the June new moon and the December full moon', () => {
  const kings = kingTides(year);
  const near = (m, d, kind) => kings.some((k) => k.kind === kind && Math.abs(jdeToUtc(k.jde) - julianDay(2026, m, d)) < 1.5);
  assert.ok(near(6, 15, 'new'));
  assert.ok(near(12, 24, 'full'));
  assert.ok(!near(3, 3, 'full'), 'the March full moon is far from perigee');
  for (const k of kings) assert.ok(k.gap <= 1.5);
});

test('the combined range swings between spring and neap with the elongation', () => {
  const A = tideAmplitude(moon());
  const B = tideAmplitude(sun());
  assert.ok(Math.abs(combinedRange(A, B, 0) - 1.5 * (A + B)) < 1e-12);
  assert.ok(Math.abs(combinedRange(A, B, 180) - 1.5 * (A + B)) < 1e-12);
  assert.ok(Math.abs(combinedRange(A, B, 90) - 1.5 * (A - B)) < 1e-12);
  const r = sampleRange(julianDay(2026, 1, 1), 365, 0.5).map((p) => p.range);
  assert.ok(Math.min(...r) > 0.19 && Math.min(...r) < 0.26, `smallest ${Math.min(...r)}`);
  assert.ok(Math.max(...r) > 0.88 && Math.max(...r) < 0.95, `largest ${Math.max(...r)}`);
  const dec = rangeAt(julianDay(2026, 12, 24.1));
  assert.ok(dec.elongation > 170 && dec.moonDistance < 3.58e8);
});

test('the equator point sees two tides a day', () => {
  const start = julianDay(2026, 11, 1);
  let highs = 0;
  let prev = heightOnEquator(start - 0.01);
  let cur = heightOnEquator(start);
  for (let t = 0.01; t <= 10; t += 0.01) {
    const next = heightOnEquator(start + t);
    if (cur > prev && cur >= next) highs += 1;
    prev = cur;
    cur = next;
  }
  // Ten days at one high water every 12 h 25 min.
  assert.ok(highs >= 19 && highs <= 20, `${highs} high waters`);
  assert.ok(Math.abs(earthTurn(2451545.0) - 280.46061837) < 1e-9);
});

test('the chart draws a curve, the events and the perigean spring bands', () => {
  const r = renderMonth({ start: julianDay(2026, 11, 1), days: 59, selected: julianDay(2026, 11, 24) });
  assert.ok(!r.svg.includes('NaN'));
  assert.equal((r.svg.match(/class="king"/g) || []).length, r.kings.length);
  assert.ok(r.kings.length >= 2);
  assert.equal((r.svg.match(/class="ev /g) || []).length, r.events.length);
  assert.ok(r.svg.includes('class="cursor"'));
  assert.match(eventLabel({ kind: 'perigee', jde: julianDay(2026, 12, 24.35), km: 356660 }), /^Perigee \(Moon nearest\), 24 Dec 2026, 08:\d\d UTC, 356,660 km$/);
});
