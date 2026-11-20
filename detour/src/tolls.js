// Congestion tolls. A driver joining a crowded road slows each of the x drivers already on it by b
// minutes, so the delay they cause is b x. Charge that as a toll, priced in minutes, at the best
// split's traffic, and drivers who each minimise their own time plus toll land on the best split.

import { outcomes } from './equilibrium.js';
import { roadFlows } from './network.js';

// Toll on each road, in minutes, from the traffic of the best split.
export function marginalTolls(scene, roads, demand) {
  const o = outcomes(scene, roads, demand);
  const x = roadFlows(roads, o.routes, o.optimum.flows);
  return new Map(roads.map((r) => [r.id, r.b * x.get(r.id)]));
}

// What drivers do when every road charges its toll: the equilibrium of time plus toll.
// Returns { routes, flows, times (travel minutes), tolls (per route), perDriver (travel minutes), tollPerDriver }.
export function tolledOutcome(scene, roads, demand) {
  const tolls = marginalTolls(scene, roads, demand);
  const priced = roads.map((r) => ({ ...r, a: r.a + tolls.get(r.id) }));
  const o = outcomes(scene, priced, demand);
  const flows = o.equilibrium.flows;
  const x = roadFlows(roads, o.routes, flows);
  const byId = new Map(roads.map((r) => [r.id, r]));
  const times = o.routes.map((rt) => rt.reduce((t, id) => t + byId.get(id).a + byId.get(id).b * x.get(id), 0));
  const routeTolls = o.routes.map((rt) => rt.reduce((t, id) => t + tolls.get(id), 0));
  const total = times.reduce((s, t, i) => s + t * flows[i], 0);
  const paid = routeTolls.reduce((s, t, i) => s + t * flows[i], 0);
  return {
    routes: o.routes,
    flows,
    times,
    tolls: routeTolls,
    roadTolls: tolls,
    total,
    perDriver: demand > 0 ? total / demand : Math.min(...times),
    tollPerDriver: demand > 0 ? paid / demand : 0,
  };
}
