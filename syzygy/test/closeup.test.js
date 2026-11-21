import { test } from 'node:test';
import assert from 'node:assert/strict';
import { magnitude, offset, track, renderCloseup, closeupText } from '../src/closeup.js';
import { eclipses } from '../src/eclipses.js';
import { julianDay, calendarDate } from '../src/time.js';

// Magnitudes from NASA's eclipse decade tables (eclipse.gsfc.nasa.gov,
// SEdecade2021 and LEdecade2021): solar magnitude and umbral lunar magnitude.
const NASA = {
  '2021-6-10': 0.943, '2021-12-4': 1.037, '2022-4-30': 0.640, '2022-10-25': 0.862, '2023-4-20': 1.013,
  '2023-10-14': 0.952, '2024-4-8': 1.057, '2024-10-2': 0.933, '2025-3-29': 0.938, '2025-9-21': 0.855,
  '2026-2-17': 0.963, '2026-8-12': 1.039, '2027-2-6': 0.928, '2027-8-2': 1.079, '2028-1-26': 0.921,
  '2028-7-22': 1.056, '2029-1-14': 0.871, '2029-6-12': 0.458, '2029-7-11': 0.230, '2029-12-5': 0.891,
  '2030-6-1': 0.944, '2030-11-25': 1.047,
  'L2021-5-26': 1.009, 'L2021-11-19': 0.974, 'L2022-5-16': 1.414, 'L2022-11-8': 1.359, 'L2023-5-5': -0.046,
  'L2023-10-28': 0.122, 'L2024-3-25': -0.132, 'L2024-9-18': 0.085, 'L2025-3-14': 1.178, 'L2025-9-7': 1.362,
  'L2026-3-3': 1.151, 'L2026-8-28': 0.930, 'L2027-2-20': -0.057, 'L2027-7-18': -1.068, 'L2027-8-17': -0.525,
  'L2028-1-12': 0.066, 'L2028-7-6': 0.389, 'L2028-12-31': 1.246, 'L2029-6-26': 1.844, 'L2029-12-20': 1.117,
  'L2030-6-15': 0.502, 'L2030-12-9': -0.163,
};

const decade = eclipses(julianDay(2021, 1, 1), julianDay(2031, 1, 1));
const keyOf = (e) => {
  const c = calendarDate(e.greatest);
  return `${e.kind === 'full' ? 'L' : ''}${c.year}-${c.month}-${c.day}`;
};
const find = (key) => decade.find((e) => keyOf(e) === key);

test('every magnitude for 2021-2030 is within 0.02 of NASA', () => {
  assert.equal(decade.length, Object.keys(NASA).length);
  for (const e of decade) {
    const m = magnitude(e);
    const mine = e.kind === 'full' ? m.umbral : m.solar;
    assert.ok(Math.abs(mine - NASA[keyOf(e)]) < 0.02, `${keyOf(e)}: ${mine.toFixed(3)} vs ${NASA[keyOf(e)]}`);
  }
});

test('total eclipses have magnitude above 1 and annular ones below', () => {
  for (const e of decade) {
    const m = magnitude(e);
    if (e.kind === 'new' && e.eclipse === 'total') assert.ok(m.solar > 1);
    if (e.kind === 'new' && e.eclipse === 'annular') assert.ok(m.solar < 1);
    if (e.kind === 'full' && e.eclipse === 'total') assert.ok(m.umbral > 1);
    if (e.kind === 'full' && e.eclipse === 'penumbral') assert.ok(m.umbral < 0 && m.penumbral > 0);
  }
});

test('the Moon passes the axis at greatest eclipse, nearest in the middle of its track', () => {
  const e = find('L2026-3-3');
  const here = offset(e.greatest, e.kind);
  assert.ok(Math.abs(Math.hypot(here.x, here.y) - e.gap) < 0.002);
  const path = track(e);
  assert.equal(path.length, 25);
  const dist = path.map((p) => Math.hypot(p.x, p.y));
  assert.equal(dist.indexOf(Math.min(...dist)), 12);
  const flat = offset(e.greatest, e.kind, 0);
  assert.equal(Math.abs(flat.y), 0);
});

test('the close-up draws the shadow for a lunar eclipse and the Sun for a solar one', () => {
  const lunar = renderCloseup(find('L2026-3-3'));
  assert.match(lunar, /class="penumbra"/);
  assert.match(lunar, /class="umbra"/);
  assert.doesNotMatch(lunar, /cu-sun/);
  assert.match(lunar, /class="cu-track" points="([\d.]+,[\d.]+ ){24}[\d.]+,[\d.]+"/);
  const solar = renderCloseup(find('2026-8-12'));
  assert.match(solar, /class="cu-sun"/);
  assert.doesNotMatch(solar, /umbra/);
  const sun = Number(solar.match(/class="cu-sun" cx="170" cy="170" r="([\d.]+)"/)[1]);
  const moon = Number(solar.match(/class="cu-moon" cx="[\d.]+" cy="[\d.]+" r="([\d.]+)"/)[1]);
  assert.ok(moon > sun, 'a total eclipse draws the Moon larger than the Sun');
});

test('the words follow the magnitude', () => {
  assert.equal(closeupText(find('2026-8-12')), 'Magnitude 1.039: where the eclipse is deepest, the Moon looks 4% wider than the Sun and hides it completely.');
  assert.match(closeupText(find('2026-2-17')), /^Magnitude 0\.96\d: .* narrower than the Sun and leaves a bright ring\.$/);
  assert.match(closeupText(find('2022-4-30')), /^Magnitude 0\.6\d\d: where the eclipse is deepest, near the edge of the Earth, the Moon covers 6\d% of the Sun’s diameter\.$/);
  assert.match(closeupText(find('L2026-3-3')), /^Umbral magnitude 1\.15: the whole Moon is inside the dark shadow/);
  assert.match(closeupText(find('L2026-8-28')), /^Umbral magnitude 0\.9\d: at greatest eclipse 9\d% of the Moon’s diameter/);
  assert.match(closeupText(find('L2024-3-25')), /^Umbral magnitude -0\.13: the Moon misses the dark shadow/);
});
