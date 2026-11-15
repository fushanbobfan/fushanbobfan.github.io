import test from 'node:test';
import assert from 'node:assert/strict';
import { bellBlowTimes, matchWindow, matchPresses, strikingReport } from '../src/ringer.js';
import { blowTime } from '../src/striking.js';
import { leadChanges, plainCourse } from '../src/changes.js';

const { rows } = plainCourse(leadChanges('x16x16x16,12', 6), 6);
const dt = 0.25;

test('a bell strikes once a row, where the row puts it', () => {
  const times = bellBlowTimes(rows, 2, dt);
  assert.equal(times.length, rows.length);
  assert.equal(times[0], blowTime(0, 1, 6, dt));
  assert.equal(times[1], blowTime(1, 0, 6, dt), 'row 1 is 214365: the second leads');
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
});

test('the window is half the shortest gap between one bell\'s blows', () => {
  const w = matchWindow(6, dt);
  for (const bell of [1, 2, 6]) {
    const times = bellBlowTimes(rows, bell, dt);
    const shortest = Math.min(...times.slice(1).map((t, i) => t - times[i]));
    assert.ok(w <= shortest / 2 + 1e-12);
  }
});

test('presses near blows are paired, with signed errors', () => {
  const blows = [1, 2.5, 4];
  const m = matchPresses(blows, [1.05, 2.4, 4.02], 0.6);
  assert.deepEqual(m.errors.map((e) => Math.round(e * 100) / 100), [0.05, -0.1, 0.02]);
  assert.deepEqual(m.extras, []);
});

test('a blow keeps only the closest press; the rest are extras', () => {
  const m = matchPresses([1, 3], [0.8, 1.02, 2.0, 5], 0.6);
  assert.ok(Math.abs(m.errors[0] - 0.02) < 1e-12);
  assert.equal(m.errors[1], null);
  assert.deepEqual(m.extras, [0.8, 2.0, 5]);
});

test('the report counts good, early, late and missed blows', () => {
  const blows = [1, 2, 3, 4, 5];
  const m = matchPresses(blows, [1.01, 1.8, 3.2, 4.0], 0.4);
  const r = strikingReport(blows, m, 0.25, 0.4, 10);
  assert.deepEqual(
    { struck: r.struck, good: r.good, early: r.early, late: r.late, missed: r.missed, extras: r.extras },
    { struck: 4, good: 2, early: 1, late: 1, missed: 1, extras: 0 },
  );
  assert.ok(Math.abs(r.meanError - (0.01 + 0.2 + 0.2 + 0) / 4) < 1e-12);
});

test('a blow still inside its window is not yet missed', () => {
  const blows = [1, 2];
  const r = strikingReport(blows, matchPresses(blows, [1], 0.4), 0.25, 0.4, 2.1);
  assert.equal(r.missed, 0);
  assert.equal(strikingReport(blows, matchPresses(blows, [1], 0.4), 0.25, 0.4, 2.5).missed, 1);
});

test('perfect striking through a whole course scores every blow good', () => {
  const times = bellBlowTimes(rows, 4, dt);
  const r = strikingReport(times, matchPresses(times, times, matchWindow(6, dt)), dt, matchWindow(6, dt));
  assert.equal(r.good, rows.length);
  assert.equal(r.meanError, 0);
});
