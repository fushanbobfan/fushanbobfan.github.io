// Day by day: how drivers find the equilibrium. Each morning every driver knows yesterday's route
// times. On a route slower than the fastest, a share of its drivers switches to the fastest route,
// larger the more time they would save. Repeated, this settles where no route in use is slower.

import { routes, routeTimes, totalTime } from './network.js';
import { outcomes } from './equilibrium.js';

const keyOf = (r) => r.join('>');

// Drivers on each of `routeList`, carried over from an earlier split by route; new routes start empty.
export function carryOver(fromRoutes, fromFlows, routeList) {
  const by = new Map(fromRoutes.map((r, i) => [keyOf(r), fromFlows[i]]));
  return routeList.map((r) => by.get(keyOf(r)) || 0);
}

// One day of switching. rate is the share of drivers who would move if their route took twice the fastest.
export function nextDay(roads, routeList, flows, rate) {
  const times = routeTimes(roads, routeList, flows);
  const fastest = Math.min(...times);
  const best = times.map((t, i) => (t <= fastest + 1e-9 ? i : -1)).filter((i) => i >= 0);
  const next = flows.slice();
  let moved = 0;
  times.forEach((t, i) => {
    if (t <= fastest + 1e-9 || flows[i] <= 0 || t <= 0) return;
    const m = Math.min(flows[i], rate * flows[i] * ((t - fastest) / t) * 2);
    next[i] -= m;
    moved += m;
  });
  for (const i of best) next[i] += moved / best.length;
  return next;
}

// The split on each day from day 0 (start) to day `days`, with each day's route times and minutes per driver.
export function learn(roads, routeList, start, { days = 40, rate = 0.25 } = {}) {
  const demand = start.reduce((s, f) => s + f, 0);
  const out = [];
  let flows = start.slice();
  for (let day = 0; day <= days; day++) {
    const times = routeTimes(roads, routeList, flows);
    out.push({ day, flows, times, perDriver: demand > 0 ? totalTime(roads, routeList, flows) / demand : Math.min(...times) });
    flows = nextDay(roads, routeList, flows, rate);
  }
  return out;
}

// Where a replay starts. With roads open: the settled traffic before they opened. Otherwise: drivers spread evenly.
export function replayStart(scene, closedRoads, roads, demand) {
  const routeList = routes(scene, roads);
  if (closedRoads.length !== roads.length) {
    const before = outcomes(scene, closedRoads, demand);
    return { routes: routeList, flows: carryOver(before.routes, before.equilibrium.flows, routeList), from: 'closed' };
  }
  return { routes: routeList, flows: routeList.map(() => demand / routeList.length), from: 'even' };
}
