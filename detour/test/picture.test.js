import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formula, renderNetwork, routeTable, roadCurve, pointOn, minutes } from '../src/draw.js';
import { createTraffic, advance, syncTraffic, MIN_VISIBLE_MINUTES } from '../src/traffic.js';
import { renderChart, rangesAbove, niceStep } from '../src/chart.js';
import { openRoads, roadFlows, routeName } from '../src/network.js';
import { outcomes, sweep } from '../src/equilibrium.js';
import { sceneById } from '../src/scenes.js';

const braess = sceneById('braess');
const count = (s, re) => (s.match(re) || []).length;

test('road rules read the way a person would write them', () => {
  assert.equal(formula({ a: 0, b: 0.01 }), 'x/100');
  assert.equal(formula({ a: 45, b: 0 }), '45');
  assert.equal(formula({ a: 0, b: 0 }), '0');
  assert.equal(formula({ a: 10, b: 0.02 }), '10 + x/50');
  assert.equal(minutes(64.6875), '64.7 min');
  assert.equal(minutes(79.98), '80 min');
  assert.equal(minutes(-0.01), '0 min');
});

test('the network shows every road, marks the closed link and gives it a button role', () => {
  const roads = openRoads(braess, new Set());
  const o = outcomes(braess, roads, 4000);
  const svg = renderNetwork({ scene: braess, open: new Set(), flows: roadFlows(roads, o.routes, o.equilibrium.flows) });
  assert.equal(count(svg, /class="road /g), 5);
  assert.equal(count(svg, /class="node/g), 4);
  assert.match(svg, /data-road="AB" role="button" tabindex="0" aria-pressed="false" aria-label="the link from A to B, closed\. Press to open"/);
  assert.match(svg, /20 min · 2,000 cars/);
  assert.match(svg, /45 min · 2,000 cars/);
  assert.match(svg, /<g id="cars"/);
});

test('opening the link puts all 4000 drivers on it in the picture', () => {
  const open = new Set(['AB']);
  const roads = openRoads(braess, open);
  const o = outcomes(braess, roads, 4000);
  const svg = renderNetwork({ scene: braess, open, flows: roadFlows(roads, o.routes, o.equilibrium.flows) });
  assert.match(svg, /aria-pressed="true" aria-label="the link from A to B, open\. 4,000 drivers, 0 min"/);
  assert.match(svg, /40 min · 4,000 cars/);
});

test('route table lists both outcomes', () => {
  const roads = openRoads(braess, new Set(['AB']));
  const o = outcomes(braess, roads, 4000);
  const html = routeTable(o.routes.map((r) => routeName(braess, r)), o.equilibrium, o.optimum);
  assert.equal(count(html, /<tr><th scope="row">/g), 3);
  assert.match(html, /S → A → B → T<\/th><td class="num">4,000<\/td><td class="num">80 min<\/td>/);
});

test('curves start and end at their nodes', () => {
  const c = roadCurve(sceneById('pigou'), sceneById('pigou').roads[0]);
  assert.deepEqual(pointOn(c, 0), { x: 90, y: 210 });
  assert.deepEqual(pointOn(c, 1), { x: 630, y: 210 });
  assert.ok(pointOn(c, 0.5).y !== 210);
});

test('cars cross each road in its travel time and leave at the end', () => {
  const roads = openRoads(braess, new Set());
  const o = outcomes(braess, roads, 4000);
  const plan = {
    routes: o.routes,
    flows: o.equilibrium.flows,
    roads: new Map(roads.map((r) => [r.id, r])),
    roadFlows: roadFlows(roads, o.routes, o.equilibrium.flows),
    carsPerMinute: 2,
  };
  const s = createTraffic();
  advance(s, plan, 1);
  assert.equal(s.cars.length, 2);
  assert.deepEqual(s.cars.map((c) => c.routeIndex).sort(), [0, 1]);
  const first = s.cars[0];
  advance(s, { ...plan, carsPerMinute: 0 }, 10);
  assert.equal(first.leg, 0);
  assert.ok(Math.abs(first.t - 0.5) < 1e-9, 'S to A takes 20 minutes with 2000 drivers on it, so halfway after 10');
  advance(s, { ...plan, carsPerMinute: 0 }, 15);
  assert.equal(first.leg, 1);
  assert.ok(Math.abs(first.t - 5 / 45) < 1e-9, 'then 5 minutes into the 45-minute road');
  advance(s, { ...plan, carsPerMinute: 0 }, 40 + 1e-6);
  assert.equal(s.cars.length, 0, 'both 65-minute trips are over');
});

test('in steady state the cars on screen follow the trip time', () => {
  const open = new Set(['AB']);
  const roads = openRoads(braess, open);
  const o = outcomes(braess, roads, 4000);
  const plan = {
    routes: o.routes,
    flows: o.equilibrium.flows,
    roads: new Map(roads.map((r) => [r.id, r])),
    roadFlows: roadFlows(roads, o.routes, o.equilibrium.flows),
    carsPerMinute: 2,
  };
  const s = createTraffic();
  for (let i = 0; i < 400; i++) advance(s, plan, 0.5);
  const expect = 2 * (80 + MIN_VISIBLE_MINUTES);
  assert.ok(Math.abs(s.cars.length - expect) <= 2, `${s.cars.length} cars, expected about ${expect}`);
  assert.ok(s.cars.every((c) => c.routeIndex === 1));
});

test('chart shades where opening the link is worse', () => {
  const closed = sweep(braess, openRoads(braess, new Set()), 0, 10000, 100).map((p) => ({ demand: p.demand, value: p.equilibrium }));
  const opened = sweep(braess, openRoads(braess, new Set(['AB'])), 0, 10000, 100).map((p) => ({ demand: p.demand, value: p.equilibrium }));
  assert.deepEqual(rangesAbove(opened, closed), [[3000, 9000]]);
  const svg = renderChart({
    series: [
      { id: 'closed', label: 'closed', points: closed },
      { id: 'open', label: 'open', points: opened },
    ],
    marker: { demand: 4000, value: 80 },
    worse: [[3000, 9000]],
    maxDemand: 10000,
  });
  assert.equal(count(svg, /class="series /g), 2);
  assert.equal(count(svg, /class="worse"/g), 1);
  assert.match(svg, /10,000<\/text>/);
  assert.equal(niceStep(100, 5), 20);
});

test('changing the roads recolours kept cars, drops cars on lost routes and empties the road at zero demand', () => {
  const planFor = (open, d) => {
    const roads = openRoads(braess, open);
    const o = outcomes(braess, roads, d);
    return { routes: o.routes, flows: o.equilibrium.flows, roads: new Map(roads.map((r) => [r.id, r])), roadFlows: roadFlows(roads, o.routes, o.equilibrium.flows), carsPerMinute: 2 };
  };
  const s = createTraffic();
  advance(s, planFor(new Set(), 4000), 1);
  const lower = s.cars.find((c) => c.key === 'SB>BT');
  assert.equal(lower.routeIndex, 1);
  syncTraffic(s, planFor(new Set(['AB']), 4000));
  assert.equal(lower.routeIndex, 2, 'S → B → T is third once the link adds a route');
  advance(s, planFor(new Set(['AB']), 4000), 1);
  assert.ok(s.cars.some((c) => c.key === 'SA>AB>BT'));
  syncTraffic(s, planFor(new Set(), 4000));
  assert.ok(s.cars.every((c) => c.key !== 'SA>AB>BT'), 'closing the link removes its cars at once');
  syncTraffic(s, planFor(new Set(), 0));
  assert.equal(s.cars.length, 0);
  assert.equal(s.owed.size, 0);
});
