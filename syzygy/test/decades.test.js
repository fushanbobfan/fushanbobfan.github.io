import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  windowYears, decadeRows, sarosFamily, renderDecades, sarosText, eclipseId, findEclipse, SAROS,
} from '../src/decades.js';
import { buildYear } from '../src/year.js';
import { MOON_INCLINATION } from '../src/eclipses.js';

const count = (s, re) => (s.match(re) || []).length;
const cache = new Map();
const rows = decadeRows(windowYears(2026, 1900, 2100), MOON_INCLINATION, cache);
const byDate = (y, m, d) => rows.flatMap((r) => r.eclipses).find((e) => {
  const row = rows.find((r) => r.year === y);
  return e.greatest >= row.start && e.greatest < row.end
    && Math.abs(e.greatest - (row.start + dayOfYear(y, m, d))) < 1;
});

function dayOfYear(y, m, d) {
  return (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000 + 0.5;
}

test('the window holds two saros cycles of years and stays inside the range', () => {
  assert.deepEqual([windowYears(2026, 1900, 2100)[0], windowYears(2026, 1900, 2100).at(-1)], [2008, 2044]);
  assert.equal(windowYears(1901, 1900, 2100)[0], 1900);
  assert.equal(windowYears(1901, 1900, 2100).length, 37);
  assert.equal(windowYears(2099, 1900, 2100).at(-1), 2100);
  assert.equal(windowYears(2099, 1900, 2100).length, 37);
});

test('rows built for the grid match the full year and are reused', () => {
  const full = buildYear(2026);
  const row = rows.find((r) => r.year === 2026);
  assert.deepEqual(row.eclipses.map((e) => e.eclipse), full.eclipses.map((e) => e.eclipse));
  assert.equal(row.seasons.length, full.seasons.length);
  row.seasons.forEach((s, i) => assert.ok(Math.abs(s.start - full.seasons[i].start) < 0.05));
  assert.equal(cache.size, 37);
  decadeRows([2026], MOON_INCLINATION, cache);
  assert.equal(cache.size, 37);
});

test('the 2026 August total eclipse belongs with 2008 August 1 and 2044 August 23', () => {
  const aug = byDate(2026, 8, 12);
  assert.equal(aug.eclipse, 'total');
  const family = sarosFamily(aug, rows);
  assert.deepEqual(family.map((f) => f.n), [-1, 0, 1]);
  assert.deepEqual(family.map((f) => f.e.eclipse), ['total', 'total', 'total']);
  assert.ok(Math.abs(family[0].e.greatest - (aug.greatest - SAROS)) < 0.5);
});

test('the 2024 April total eclipse returns in 2042 April', () => {
  const apr = byDate(2024, 4, 8);
  const family = sarosFamily(apr, rows);
  const later = family.find((f) => f.n === 1);
  assert.ok(later, 'no member one saros later');
  assert.equal(later.e.eclipse, 'total');
  assert.match(sarosText(apr, rows), /20 Apr 2042 \(\+1, total\)/);
});

test('every eclipse one saros after another in view is found in its family', () => {
  const all = rows.flatMap((r) => r.eclipses);
  let pairs = 0;
  for (const e of all) {
    const fam = sarosFamily(e, rows);
    const next = fam.find((f) => f.n === 1);
    if (next) pairs++;
    for (const f of fam) assert.equal(f.e.kind, e.kind);
  }
  assert.ok(pairs > 40, `only ${pairs} saros pairs in 37 years`);
});

test('the grid draws a row per year, every eclipse as a button and the selected family', () => {
  const aug = byDate(2026, 8, 12);
  const svg = renderDecades(rows, { currentYear: 2026, selectedId: eclipseId(aug) });
  assert.equal(count(svg, /class="year/g), 37);
  assert.equal(count(svg, /role="button"/g), rows.reduce((n, r) => n + r.eclipses.length, 0));
  assert.equal(count(svg, /class="mark new selected"/g), 1);
  assert.equal(count(svg, /class="mark new family"/g), 2);
  assert.equal(count(svg, /<polyline class="saros-line"/g), 1);
  assert.match(svg, /aria-label="Total solar eclipse, 12 Aug 2026"/);
  assert.equal(count(svg, /class="current-row"/g), 1);
  assert.equal(findEclipse(rows, eclipseId(aug)), aug);
});

test('the saros sentence names the gap and the relatives', () => {
  const aug = byDate(2026, 8, 12);
  const text = sarosText(aug, rows);
  assert.match(text, /^The total solar eclipse of 12 Aug 2026 repeats after one saros, 223 new moons or 18 years 11 days/);
  assert.match(text, /1 Aug 2008 \(-1, total\), 23 Aug 2044 \(\+1, total\)\.$/);
  assert.equal(sarosText(null, rows), '');
});
