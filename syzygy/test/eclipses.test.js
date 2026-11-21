import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moonPosition, sunPosition, separation, wrap180 } from '../src/ephemeris.js';
import {
  syzygies, eclipses, SYNODIC_MONTH, DRACONIC_MONTH, ECLIPSE_YEAR,
} from '../src/eclipses.js';
import { julianDay, calendarDate, deltaT, jdeToUtc, formatDateTime } from '../src/time.js';

// Greatest eclipse in Terrestrial Time, from NASA's eclipse decade tables
// (eclipse.gsfc.nasa.gov, SEdecade2021 and LEdecade2021).
const NASA_2021_2030 = [
  ['solar', 2021, 6, 10, '10:43', 'annular'], ['solar', 2021, 12, 4, '07:34', 'total'],
  ['solar', 2022, 4, 30, '20:42', 'partial'], ['solar', 2022, 10, 25, '11:01', 'partial'],
  ['solar', 2023, 4, 20, '04:17', 'hybrid'], ['solar', 2023, 10, 14, '18:00', 'annular'],
  ['solar', 2024, 4, 8, '18:18', 'total'], ['solar', 2024, 10, 2, '18:46', 'annular'],
  ['solar', 2025, 3, 29, '10:48', 'partial'], ['solar', 2025, 9, 21, '19:43', 'partial'],
  ['solar', 2026, 2, 17, '12:13', 'annular'], ['solar', 2026, 8, 12, '17:47', 'total'],
  ['solar', 2027, 2, 6, '16:00', 'annular'], ['solar', 2027, 8, 2, '10:07', 'total'],
  ['solar', 2028, 1, 26, '15:08', 'annular'], ['solar', 2028, 7, 22, '02:56', 'total'],
  ['solar', 2029, 1, 14, '17:13', 'partial'], ['solar', 2029, 6, 12, '04:06', 'partial'],
  ['solar', 2029, 7, 11, '15:37', 'partial'], ['solar', 2029, 12, 5, '15:03', 'partial'],
  ['solar', 2030, 6, 1, '06:29', 'annular'], ['solar', 2030, 11, 25, '06:51', 'total'],
  ['lunar', 2021, 5, 26, '11:19', 'total'], ['lunar', 2021, 11, 19, '09:04', 'partial'],
  ['lunar', 2022, 5, 16, '04:12', 'total'], ['lunar', 2022, 11, 8, '11:00', 'total'],
  ['lunar', 2023, 5, 5, '17:24', 'penumbral'], ['lunar', 2023, 10, 28, '20:15', 'partial'],
  ['lunar', 2024, 3, 25, '07:13', 'penumbral'], ['lunar', 2024, 9, 18, '02:45', 'partial'],
  ['lunar', 2025, 3, 14, '06:59', 'total'], ['lunar', 2025, 9, 7, '18:12', 'total'],
  ['lunar', 2026, 3, 3, '11:34', 'total'], ['lunar', 2026, 8, 28, '04:14', 'partial'],
  ['lunar', 2027, 2, 20, '23:14', 'penumbral'], ['lunar', 2027, 7, 18, '16:04', 'penumbral'],
  ['lunar', 2027, 8, 17, '07:14', 'penumbral'], ['lunar', 2028, 1, 12, '04:14', 'partial'],
  ['lunar', 2028, 7, 6, '18:20', 'partial'], ['lunar', 2028, 12, 31, '16:53', 'total'],
  ['lunar', 2029, 6, 26, '03:23', 'total'], ['lunar', 2029, 12, 20, '22:43', 'total'],
  ['lunar', 2030, 6, 15, '18:34', 'partial'], ['lunar', 2030, 12, 9, '22:28', 'penumbral'],
];

function nasaJde([, y, m, d, hm]) {
  const [h, min] = hm.split(':').map(Number);
  return julianDay(y, m, d) + (h + min / 60) / 24;
}

test('the Moon matches the worked example in Meeus (1992 April 12, 0h TD)', () => {
  const m = moonPosition(2448724.5);
  assert.ok(Math.abs(m.lon - 133.162655) < 0.001, `longitude ${m.lon}`);
  assert.ok(Math.abs(m.lat - -3.229126) < 0.005, `latitude ${m.lat}`);
  assert.ok(Math.abs(m.dist - 368409.7) < 25, `distance ${m.dist}`);
});

test('the Sun matches the worked example in Meeus (1992 October 13, 0h TD)', () => {
  const s = sunPosition(2448908.5);
  // Meeus gives 199.90988 before aberration; this function subtracts 20.5".
  assert.ok(Math.abs(s.lon - (199.90988 - 0.00569)) < 0.0005, `longitude ${s.lon}`);
  assert.ok(Math.abs(s.dist - 0.99766) < 0.00002, `distance ${s.dist}`);
});

test('angles fold and separations measure the short way round', () => {
  assert.equal(wrap180(350), -10);
  assert.equal(wrap180(-190), 170);
  assert.ok(Math.abs(separation(359, 0, 1, 0) - 2) < 1e-9);
  assert.ok(Math.abs(separation(10, 3, 10, -1) - 4) < 1e-9);
});

test('julian days round-trip through the calendar', () => {
  assert.equal(julianDay(2000, 1, 1.5), 2451545.0);
  assert.equal(julianDay(1957, 10, 4.81), 2436116.31);
  const c = calendarDate(2436116.31);
  assert.deepEqual([c.year, c.month, c.day, c.hour, c.minute], [1957, 10, 4, 19, 26]);
  assert.ok(deltaT(2025) > 60 && deltaT(2025) < 80);
  assert.equal(formatDateTime(jdeToUtc(julianDay(2024, 4, 8) + 0.5)), '8 Apr 2024, 11:59 UTC');
});

test('every eclipse NASA lists for 2021-2030 is found, on time and of the right type', () => {
  const found = eclipses(julianDay(2021, 1, 1), julianDay(2031, 1, 1));
  for (const row of NASA_2021_2030) {
    const kind = row[0] === 'solar' ? 'new' : 'full';
    const jde = nasaJde(row);
    const hit = found.find((e) => e.kind === kind && Math.abs(e.greatest - jde) < 0.5);
    assert.ok(hit, `missing ${row.join(' ')}`);
    assert.equal(hit.eclipse, row[5], `${row.join(' ')} classified as ${hit.eclipse}`);
    assert.ok(Math.abs(hit.greatest - jde) * 1440 < 5, `${row.join(' ')} off by ${((hit.greatest - jde) * 1440).toFixed(1)} min`);
  }
  assert.equal(found.length, NASA_2021_2030.length, 'no eclipses NASA does not list');
});

test('a decade has about 124 new and full moons, alternating', () => {
  const all = syzygies(julianDay(2021, 1, 1), julianDay(2031, 1, 1));
  assert.equal(all.length, 247);
  for (let i = 1; i < all.length; i++) {
    assert.notEqual(all[i].kind, all[i - 1].kind);
    const gap = all[i].jde - all[i - 1].jde;
    assert.ok(gap > 13.8 && gap < 15.8, `half-month of ${gap} days`);
  }
});

test('with a flat orbit every new moon and every full moon is an eclipse', () => {
  const all = syzygies(julianDay(2026, 1, 1), julianDay(2027, 1, 1), { tilt: 0 });
  assert.ok(all.length >= 24);
  for (const s of all) {
    assert.ok(s.eclipse, `${s.kind} at ${s.jde} missed`);
    assert.notEqual(s.eclipse, 'partial');
    assert.notEqual(s.eclipse, 'penumbral');
    assert.ok(Math.abs(s.lat) < 1e-9);
  }
});

test('a steeper orbit gives fewer eclipses than the real one', () => {
  const range = [julianDay(2021, 1, 1), julianDay(2031, 1, 1)];
  const real = eclipses(...range).length;
  const steep = eclipses(...range, { tilt: 10 }).length;
  assert.ok(steep < real * 0.7, `${steep} vs ${real}`);
});

test('the month lengths give the eclipse year and the saros', () => {
  const eclipseYear = 1 / (1 / DRACONIC_MONTH - 1 / SYNODIC_MONTH);
  assert.ok(Math.abs(eclipseYear - ECLIPSE_YEAR) < 0.001);
  assert.ok(Math.abs(223 * SYNODIC_MONTH - 242 * DRACONIC_MONTH) < 0.04);
});
