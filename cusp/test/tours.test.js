import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSICAL, angleGap, isValidMachine } from '../src/machine.js';
import { findCusps, traceFoldSet } from '../src/foldset.js';
import { TOUR_NAMES, makeTour } from '../src/tours.js';
import { sweepPath } from '../src/wheel.js';
import { DEFAULT_ANGLE, DEFAULT_CONTROL, decodeState, encodeState } from '../src/share.js';

const machines = [
  CLASSICAL,
  { r: 0.5, a: 2.4, l: 0.8, s: 1.6 },
  { r: 0.5, a: 3, l: 1.4, s: 0.5 },
  { r: 0.5, a: 1.6, l: 0.4, s: 1 },
];

function tourOn(m, name) {
  const chains = traceFoldSet(m);
  return makeTour(name, chains, findCusps(m, chains));
}

for (const m of machines) {
  const label = `a=${m.a} l=${m.l} s=${m.s}`;
  test(`the tours tell the story they claim on ${label}`, () => {
    const snap = tourOn(m, 'snap');
    assert.equal(sweepPath(m, snap.path, snap.start).snaps.length, 2, 'snap');
    const round = tourOn(m, 'round');
    assert.equal(sweepPath(m, round.path, round.start).snaps.length, 0, 'round');
    const level = tourOn(m, 'level');
    assert.equal(sweepPath(m, level.path, level.start).snaps.length, 0, 'level');
  });
}

test('the two ways round the cusp end in the same well, one with a snap', () => {
  const m = CLASSICAL;
  const round = tourOn(m, 'round');
  const smooth = sweepPath(m, round.path, round.start);
  assert.ok(smooth.rest < 0, 'the wheel crossed to the other side');

  // The same two end points, joined by a path that drops through the diamond.
  const first = round.path[0];
  const last = round.path[round.path.length - 1];
  const across = sweepPath(m, [first, { x: -2, y: first.y }, { x: -2, y: last.y - 0.5 }, last], round.start);
  assert.equal(across.snaps.length, 1);
  // The snap may carry the wheel the long way round, so compare angles on the circle.
  assert.ok(Math.abs(angleGap(across.rest, smooth.rest)) < 1e-6, `${across.rest} vs ${smooth.rest}`);
});

test('entering the tip, a tiny offset chooses the side', () => {
  const m = CLASSICAL;
  const up = tourOn(m, 'fork');
  const down = { path: up.path.map((p) => ({ x: p.x, y: -p.y })), start: -up.start };
  const a = sweepPath(m, up.path, up.start);
  const b = sweepPath(m, down.path, down.start);
  assert.equal(a.snaps.length, 0);
  assert.ok(Math.abs(a.rest - b.rest) > 0.5, `${a.rest} and ${b.rest}`);
  assert.ok(Math.abs(a.rest + b.rest) < 1e-6);
});

test('every tour is named', () => {
  for (const name of Object.keys(TOUR_NAMES)) assert.ok(tourOn(CLASSICAL, name).path.length > 1);
  assert.throws(() => tourOn(CLASSICAL, 'nope'));
});

test('share links round trip', () => {
  const state = { machine: { r: 0.5, a: 2.4, l: 0.8, s: 1.6 }, control: { x: -2.125, y: 0.5 }, theta: -1.25 };
  assert.deepEqual(decodeState(`#${encodeState(state)}`), state);
});

test('a broken or empty link falls back to the classical machine', () => {
  const empty = decodeState('');
  assert.deepEqual(empty.machine, { ...CLASSICAL });
  assert.deepEqual(empty.control, { ...DEFAULT_CONTROL });
  assert.equal(empty.theta, DEFAULT_ANGLE);
  assert.ok(isValidMachine(decodeState('#a=0.1&l=9').machine));
  assert.equal(decodeState('#x=zz').control.x, DEFAULT_CONTROL.x);
});
