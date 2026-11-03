import { test } from 'node:test';
import assert from 'node:assert/strict';
import { day, isoDay, fromIsoDay, days, motion, monthTicks } from '../src/format.js';
import { julianDay } from '../src/orbits.js';

test('dates read and print in UTC', () => {
  const jd = fromIsoDay('2025-01-16');
  assert.equal(jd, julianDay(new Date('2025-01-16T00:00:00Z')));
  assert.equal(isoDay(jd), '2025-01-16');
  assert.equal(day(jd + 0.9), '16 Jan 2025');
  assert.equal(fromIsoDay('16/01/2025'), null);
});

test('day counts and motions', () => {
  assert.equal(days(1.2), '1 day');
  assert.equal(days(-79), '79 days');
  assert.equal(motion(0.5), '30.0′ a day east');
  assert.equal(motion(-0.38), '22.8′ a day west');
  assert.equal(motion(1.2), '1.20° a day east');
  assert.equal(motion(0.0001), 'standing still');
});

test('month ticks fall on the first of each month inside the window', () => {
  const ticks = monthTicks(fromIsoDay('2024-11-15'), fromIsoDay('2025-03-15'));
  assert.deepEqual(ticks.map((t) => isoDay(t.jd)), ['2024-12-01', '2025-01-01', '2025-02-01', '2025-03-01']);
  assert.deepEqual(ticks.map((t) => t.label), ['Dec', 'Jan 2025', 'Feb', 'Mar']);
  const long = monthTicks(fromIsoDay('2024-01-01'), fromIsoDay('2025-12-31'));
  assert.equal(long.length, 24);
  assert.ok(long.filter((t) => t.label).length <= 8);
});
