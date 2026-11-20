import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learn, nextDay, carryOver, replayStart } from '../src/learning.js';
import { dayText } from '../src/story.js';
import { renderChart } from '../src/chart.js';
import { openRoads, routes, routeName } from '../src/network.js';
import { outcomes } from '../src/equilibrium.js';
import { sceneById, SCENES } from '../src/scenes.js';

const braess = sceneById('braess');
const closed = openRoads(braess, new Set());
const opened = openRoads(braess, new Set(['AB']));

test('a replay starts from the settled traffic before the link opened, with the link empty', () => {
  const start = replayStart(braess, closed, opened, 4000);
  assert.equal(start.from, 'closed');
  assert.deepEqual(start.flows.map(Math.round), [2000, 0, 2000]);
  const even = replayStart(braess, closed, closed, 4000);
  assert.equal(even.from, 'even');
  assert.deepEqual(even.flows, [2000, 2000]);
});

test('carrying a split over to a new set of routes keeps drivers by route', () => {
  const a = routes(braess, closed);
  const b = routes(braess, opened);
  assert.deepEqual(carryOver(a, [1500, 2500], b), [1500, 0, 2500]);
});

test('switching moves drivers to the fastest route and keeps everyone on the road', () => {
  const r = routes(braess, opened);
  const next = nextDay(opened, r, [2000, 0, 2000], 0.5);
  assert.ok(next[1] > 0, 'the free link gets its first drivers');
  assert.ok(Math.abs(next.reduce((s, f) => s + f, 0) - 4000) < 1e-9);
  // At the equilibrium nobody moves.
  const eq = outcomes(braess, opened, 4000).equilibrium.flows;
  nextDay(opened, r, eq, 0.5).forEach((f, i) => assert.ok(Math.abs(f - eq[i]) < 1e-6));
});

test('the replay climbs from 65 to the 80-minute equilibrium in Braess\'s network', () => {
  const start = replayStart(braess, closed, opened, 4000);
  const h = learn(opened, start.routes, start.flows, { days: 50, rate: 0.5 });
  assert.equal(h.length, 51);
  assert.ok(Math.abs(h[0].perDriver - 65) < 1e-9);
  assert.ok(Math.abs(h[50].perDriver - 80) < 0.5);
});

test('at the default eagerness every scene settles near its equilibrium', () => {
  for (const scene of SCENES) {
    const all = openRoads(scene, new Set(scene.roads.filter((r) => r.optional).map((r) => r.id)));
    for (const d of [2000, scene.demand]) {
      const start = replayStart(scene, openRoads(scene, new Set()), all, d);
      const h = learn(all, start.routes, start.flows, { days: 50, rate: 0.5 });
      const eq = outcomes(scene, all, d).equilibrium.perDriver;
      // Pigou at 6000 sits on the edge: the highway ties at 60 minutes, so the last drivers move slowly.
      const tol = scene.id === 'pigou' && d === 6000 ? 1.5 : 1;
      assert.ok(Math.abs(h[50].perDriver - eq) < tol, `${scene.id} at ${d}: ${h[50].perDriver} vs ${eq}`);
    }
  }
});

test('switching too readily overshoots: Pigou at 9600 drivers swings past an hour', () => {
  const pigou = sceneById('pigou');
  const start = replayStart(pigou, pigou.roads, pigou.roads, 9600);
  const h = learn(pigou.roads, start.routes, start.flows, { days: 10, rate: 1 });
  assert.ok(h[1].perDriver > 60 && h[2].perDriver < 60);
});

test('day narration', () => {
  const start = replayStart(braess, closed, opened, 4000);
  const h = learn(opened, start.routes, start.flows, { days: 50, rate: 0.5 });
  const names = start.routes.map((r) => routeName(braess, r));
  assert.equal(dayText(h, 0, names, 'closed', 80), 'Day 0: traffic as it had settled before the new roads opened, 65 min per driver. Overnight they open.');
  assert.match(dayText(h, 1, names, 'closed', 80), /^Day 1: .* S → A → B → T is fastest at .*so some of its drivers will switch tomorrow\.$/);
  assert.match(dayText(h, 50, names, 'closed', 80), /settled at the equilibrium, 80 min\.$/);
});

test('the chart can run against days', () => {
  const svg = renderChart({
    series: [{ id: 'route-0', label: 'S → A → T', color: '#e3a21a', points: [{ demand: 0, value: 65 }, { demand: 50, value: 80 }] }],
    worse: [],
    marker: null,
    maxDemand: 50,
    xLabel: 'day',
    xFormat: String,
  });
  assert.match(svg, />day<\/text>/);
  assert.match(svg, /style="stroke:#e3a21a"/);
  assert.match(svg, />50<\/text>/);
});
