import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildYear, snapshot, seasonHalfWidth, sunFromNode, phaseName } from '../src/year.js';
import { renderChart, jdeAt, scales } from '../src/chart.js';
import { renderOrbit, seasonLongitudes } from '../src/orbit.js';
import { eclipseRows, yearSummary, momentText, eclipseLabel } from '../src/story.js';
import { eclipses } from '../src/eclipses.js';
import { sunPosition } from '../src/ephemeris.js';
import { julianDay } from '../src/time.js';

const count = (s, re) => (s.match(re) || []).length;
const y2026 = buildYear(2026);

test('2026 has two eclipse seasons holding all four of its eclipses', () => {
  assert.equal(y2026.solarCount, 2);
  assert.equal(y2026.lunarCount, 2);
  assert.equal(y2026.seasons.length, 2);
  for (const e of y2026.eclipses) {
    assert.ok(y2026.seasons.some((s) => e.jde >= s.start && e.jde <= s.end), `eclipse at ${e.jde} outside a season`);
  }
  for (const s of y2026.seasons) {
    const days = s.end - s.start;
    assert.ok(days > 30 && days < 40, `season of ${days} days`);
  }
});

test('the season half-width follows from the limit and the tilt', () => {
  assert.ok(Math.abs(seasonHalfWidth(1.5, 5.145) - 16.95) < 0.05);
  assert.equal(seasonHalfWidth(1.5, 1), 90);
  assert.equal(seasonHalfWidth(1.5, 0), 90);
  assert.ok(Math.abs(sunFromNode(julianDay(2026, 2, 17.5))) < 15);
});

test('eclipse seasons arrive about 19 days earlier each year', () => {
  const later = buildYear(2027);
  const shift = (y2026.seasons[0].start + 365) - later.seasons[0].start;
  assert.ok(shift > 14 && shift < 24, `shift of ${shift} days`);
});

test('famous eclipses outside the checked decade come out right', () => {
  const cases = [
    [1919, 5, 29, 'new', 'total'], [1999, 8, 11, 'new', 'total'], [2017, 8, 21, 'new', 'total'],
    [2045, 8, 12, 'new', 'total'], [2000, 1, 21, 'full', 'total'],
  ];
  for (const [y, m, d, kind, type] of cases) {
    const found = eclipses(julianDay(y, m, d), julianDay(y, m, d + 1));
    assert.equal(found.length, 1, `${y}-${m}-${d}`);
    assert.equal(found[0].kind, kind);
    assert.equal(found[0].eclipse, type, `${y}-${m}-${d}`);
  }
});

test('the chart draws every new and full moon, labels the eclipses and describes itself', () => {
  const svg = renderChart(y2026, y2026.start + 10);
  assert.equal(count(svg, /class="event /g), y2026.events.length);
  assert.equal(count(svg, /class="event [a-z]+ hit"/g), 4);
  assert.equal(count(svg, /class="season"/g), 2);
  assert.match(svg, />Total solar · 12 Aug</);
  assert.match(svg, />Annular solar · 17 Feb</);
  assert.match(svg, /aria-label="The Moon's height above the Sun's path through 2026\. 25 new and full moons, 4 of them eclipses: 2 solar and 2 lunar\."/);
  assert.match(svg, /<line id="cursor"/);
});

test('clicking the chart maps back to the date under the pointer', () => {
  const { x } = scales(y2026);
  const t = y2026.start + 200;
  assert.ok(Math.abs(jdeAt(y2026, x(t)) - t) < 1e-6);
  assert.equal(jdeAt(y2026, -50), y2026.start);
});

test('the top view puts the Earth opposite the Sun and the Moon on its orbit', () => {
  const snap = snapshot(julianDay(2026, 8, 12.74));
  assert.equal(phaseName(snap.elongation), 'new moon');
  const svg = renderOrbit(snap, seasonLongitudes(y2026.seasons, (t) => sunPosition(t).lon), y2026.halfWidth);
  assert.equal(count(svg, /class="season-arc"/g), 2);
  assert.match(svg, /class="moon-orbit above"/);
  assert.match(svg, /class="moon-orbit below"/);
  assert.match(svg, /class="node-line aligned"/);
  const away = renderOrbit(snapshot(julianDay(2026, 5, 15)), [], y2026.halfWidth);
  assert.doesNotMatch(away, /aligned/);
});

test('the words match the numbers', () => {
  assert.equal(yearSummary(y2026, true),
    '2026 has 2 solar eclipses and 2 lunar eclipses. They all fall in the 2 eclipse seasons (Feb–Mar and Aug–Sep), when the Sun stands within 17° of a node of the Moon’s orbit.');
  const flat = buildYear(2026, 0);
  assert.match(yearSummary(flat, false), /^With the Moon’s orbit tilted only 0\.0°, every new moon lines up/);
  assert.equal(yearSummary(buildYear(2026, 10), false),
    'With a 10.0° tilt, 2026 would have no solar eclipses and 2 lunar eclipses. They all fall in the 2 eclipse seasons (Feb–Mar and Aug), when the Sun stands within 9° of a node of the Moon’s orbit.');
  for (const tilt of [1.45, 1.5, 1.55, 1.6]) {
    const d = buildYear(2026, tilt);
    if (d.halfWidth >= 90 && d.eclipses.length < d.events.length) {
      assert.match(yearSummary(d, false), /still pass just outside the limit\.$/);
    }
  }
  const rows = eclipseRows(y2026);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].when, '17 Feb 2026, 12:13 UTC');
  assert.equal(rows[0].kind, 'Annular solar');
  assert.match(rows[0].miss, /^0\.9\d° of 1\.4\d°$/);
  assert.equal(eclipseLabel({ kind: 'full', eclipse: 'penumbral' }), 'Penumbral lunar');
  const m = momentText(snapshot(julianDay(2026, 3, 3.48)), y2026);
  assert.equal(m.date, '3 Mar 2026');
  assert.match(m.line, /^Full moon, the Moon 0\.\d° (above|below) the Sun’s path\. The Sun is \d+° from a node: eclipse season\.$/);
  const off = momentText(snapshot(julianDay(2026, 5, 15)), y2026);
  assert.match(off.line, /Next eclipse season in \d+ days\.$/);
});

test('a calendar year can hold three eclipse seasons, as 2020 did', () => {
  const y = buildYear(2020);
  assert.equal(y.seasons.length, 3);
  assert.deepEqual(y.eclipses.map((e) => e.eclipse), ['penumbral', 'penumbral', 'annular', 'penumbral', 'penumbral', 'total']);
  assert.match(yearSummary(y, true), /They all fall in the 3 eclipse seasons \(Jan, Jun–Jul and Nov–Dec\)/);
});
