import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSICAL, angleGap } from '../src/machine.js';
import { restPoints, settle } from '../src/equilibria.js';
import { findCusps, traceFoldSet } from '../src/foldset.js';
import { DEFAULT_ROTOR, driveWheel, followRest, stepWheel, sweepPath } from '../src/wheel.js';

const m = CLASSICAL;
const set = traceFoldSet(m)[0].points;

function crossingsOnVertical(x) {
  const ys = [];
  for (let i = 0; i < set.length; i += 1) {
    const p = set[i];
    const q = set[(i + 1) % set.length];
    if ((p.x > x) !== (q.x > x)) ys.push(p.y + ((x - p.x) * (q.y - p.y)) / (q.x - p.x));
  }
  return ys.sort((a, b) => a - b);
}

test('a damped wheel comes to rest at a minimum', () => {
  const state = { theta: 2.5, omega: 0 };
  for (let i = 0; i < 2000; i += 1) stepWheel(state, m, -3, 0.4, 1 / 60);
  assert.ok(Math.abs(state.omega) < 1e-6);
  const nearest = restPoints(m, -3, 0.4).minima
    .some((p) => Math.abs(angleGap(p.theta, state.theta)) < 1e-5);
  assert.ok(nearest);
});

test('the rotor loses energy on the way down', () => {
  const state = { theta: 1, omega: 0 };
  const total = () => 0.5 * DEFAULT_ROTOR.inertia * state.omega ** 2;
  let peak = 0;
  for (let i = 0; i < 400; i += 1) {
    stepWheel(state, m, -1, 0.3, 1 / 240);
    peak = Math.max(peak, total());
  }
  assert.ok(peak > 0);
  assert.ok(total() < peak);
});

test('crossing the diamond snaps at the far edge in either direction: hysteresis', () => {
  const x = -2;
  const ys = crossingsOnVertical(x);
  assert.equal(ys.length, 2);
  const [bottom, top] = ys;
  // Going down, the wheel holds its well until the lower edge of the diamond...
  const down = sweepPath(m, [{ x, y: 1 }, { x, y: -1 }], 1.5);
  assert.equal(down.snaps.length, 1);
  assert.ok(Math.abs(down.snaps[0].y - bottom) < 0.01, `${down.snaps[0].y} vs ${bottom}`);
  // ...and coming back it holds the other one until the upper edge.
  const up = sweepPath(m, [{ x, y: -1 }, { x, y: 1 }], down.rest);
  assert.equal(up.snaps.length, 1);
  assert.ok(Math.abs(up.snaps[0].y - top) < 0.01, `${up.snaps[0].y} vs ${top}`);
});

test('a level pass through the diamond never snaps: the wheel stays in the well it has', () => {
  const y = 0.3;
  const across = sweepPath(m, [{ x: -1, y }, { x: -3, y }], 0.5);
  assert.equal(across.snaps.length, 0);
  assert.equal(sweepPath(m, [{ x: -3, y }, { x: -1, y }], across.rest).snaps.length, 0);
});

test('circling outside the cusp changes the side without any snap', () => {
  const cusps = findCusps(m, traceFoldSet(m)).sort((a, b) => b.x - a.x);
  const tip = cusps[0];
  const path = [];
  // A half circle round the right-hand cusp, from above to below it, staying outside the set.
  for (let i = 0; i <= 60; i += 1) {
    const a = Math.PI / 2 - (i / 60) * Math.PI;
    path.push({ x: tip.x + 0.25 * Math.cos(a), y: 0.25 * Math.sin(a) });
  }
  const startAngle = restPoints(m, path[0].x, path[0].y).minima[0].theta;
  const run = sweepPath(m, path, startAngle);
  assert.equal(run.snaps.length, 0);
  assert.ok(Math.sign(run.rest) !== Math.sign(startAngle), `${startAngle} to ${run.rest}`);
});

test('the live wheel keeps up with a slow hand and snaps at the edges of the diamond', () => {
  const x = -2;
  const [bottom, top] = crossingsOnVertical(x);
  const dt = 1 / 60;
  const speed = 0.55;
  const start = { x, y: 1 };
  const rest = settle(m, x, 1, 1.5);
  const state = { control: start, rest, theta: rest, omega: 0 };
  const snaps = [];
  let worstLag = 0;
  const run = (from, to) => {
    const steps = Math.ceil(Math.abs(to - from) / (speed * dt));
    for (let i = 1; i <= steps; i += 1) {
      const y = from + ((to - from) * i) / steps;
      const events = driveWheel(state, m, { x, y }, dt);
      snaps.push(...events);
      // Right at the edge the well moves arbitrarily fast, so lag is only held down away from it.
      if (!snaps.length && y > bottom + 0.1) {
        worstLag = Math.max(worstLag, Math.abs(angleGap(state.theta, state.rest)));
      }
    }
  };
  run(1, -1);
  run(-1, 1);
  assert.equal(snaps.length, 2, snaps.map((s) => s.y).join(' '));
  assert.ok(Math.abs(snaps[0].y - bottom) < 0.04, `${snaps[0].y} vs ${bottom}`);
  assert.ok(Math.abs(snaps[1].y - top) < 0.04, `${snaps[1].y} vs ${top}`);
  assert.ok(worstLag < 0.2, `lag ${worstLag}`);
});

test('a large step is subdivided, so the jump lands where small steps land', () => {
  const x = -2;
  const big = followRest(m, { x, y: 1 }, { x, y: -1 }, settle(m, x, 1, 1.5));
  const small = sweepPath(m, [{ x, y: 1 }, { x, y: 0.2 }, { x, y: -0.4 }, { x, y: -1 }], 1.5);
  assert.equal(big.snaps.length, 1);
  assert.ok(Math.abs(angleGap(big.rest, small.rest)) < 1e-6);
});
