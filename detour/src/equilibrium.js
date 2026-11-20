// Where the drivers go.
//
// Equilibrium (Wardrop's first principle): every driver takes a fastest route, so all routes in use
// take the same time and no unused route is faster. Optimum: the split that makes the total time
// spent by everyone as small as possible. With travel times a + b x, both are found exactly: guess
// which routes are used, solve the linear equations that say their times (or marginal times) are
// equal and add up to the demand, and keep the first guess that passes the checks.

import { routes, routeTimes, totalTime } from './network.js';

const EPS = 1e-9;

// Solves M z = v in place by Gaussian elimination with partial pivoting; returns null when singular.
export function solveLinear(M, v) {
  const n = v.length;
  const A = M.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[n] / row[i]);
}

// Shared slope between routes: overlap[p][q] = sum of b over roads that p and q both use.
function overlaps(roads, routeList) {
  const b = new Map(roads.map((r) => [r.id, r.b]));
  const sets = routeList.map((rt) => new Set(rt));
  return routeList.map((p) => routeList.map((_, q) => p.reduce((s, id) => s + (sets[q].has(id) ? b.get(id) : 0), 0)));
}

function freeTimes(roads, routeList) {
  const a = new Map(roads.map((r) => [r.id, r.a]));
  return routeList.map((rt) => rt.reduce((s, id) => s + a.get(id), 0));
}

// mult = 1 gives the equilibrium, mult = 2 the optimum (marginal time a + 2 b x on every road).
function split(roads, routeList, demand, mult) {
  const k = routeList.length;
  if (k === 0) return null;
  const A = overlaps(roads, routeList);
  const c = freeTimes(roads, routeList);
  const scale = Math.max(1, demand, ...c);
  const order = [];
  for (let mask = 1; mask < 1 << k; mask++) order.push(mask);
  order.sort((m1, m2) => popcount(m1) - popcount(m2) || m1 - m2);

  for (const mask of order) {
    const used = [];
    for (let i = 0; i < k; i++) if (mask & (1 << i)) used.push(i);
    const n = used.length;
    const M = [];
    const v = [];
    used.forEach((p) => {
      M.push([...used.map((q) => mult * A[p][q]), -1]);
      v.push(-c[p]);
    });
    M.push([...used.map(() => 1), 0]);
    v.push(demand);
    const z = solveLinear(M, v);
    if (!z) continue;
    const level = z[n];
    const flows = new Array(k).fill(0);
    let ok = true;
    used.forEach((p, i) => {
      if (z[i] < -EPS * scale) ok = false;
      flows[p] = Math.max(0, z[i]);
    });
    if (!ok) continue;
    for (let p = 0; p < k && ok; p++) {
      if (mask & (1 << p)) continue;
      const marginal = c[p] + mult * routeList.reduce((s, _, q) => s + A[p][q] * flows[q], 0);
      if (marginal < level - 1e-7 * scale) ok = false;
    }
    if (ok) return flows;
  }
  return projectedSplit(roads, routeList, demand, mult);
}

// Fallback for degenerate inputs: projected gradient descent on the route split.
function projectedSplit(roads, routeList, demand, mult) {
  const k = routeList.length;
  const A = overlaps(roads, routeList);
  const c = freeTimes(roads, routeList);
  let f = new Array(k).fill(demand / k);
  const step = 1 / Math.max(1e-9, mult * Math.max(...A.flat()) * k);
  for (let it = 0; it < 20000; it++) {
    const g = f.map((_, p) => c[p] + mult * A[p].reduce((s, a, q) => s + a * f[q], 0));
    f = projectToSimplex(f.map((x, p) => x - step * g[p]), demand);
  }
  return f;
}

// Euclidean projection onto { f >= 0, sum f = total }.
export function projectToSimplex(y, total) {
  const u = [...y].sort((p, q) => q - p);
  let acc = 0;
  let theta = 0;
  for (let i = 0; i < u.length; i++) {
    acc += u[i];
    const t = (acc - total) / (i + 1);
    if (u[i] - t > 0) theta = t;
  }
  return y.map((x) => Math.max(0, x - theta));
}

function popcount(m) {
  let c = 0;
  while (m) {
    c += m & 1;
    m >>= 1;
  }
  return c;
}

// Both outcomes for a scene with a given set of open optional roads.
// Returns { routes, equilibrium, optimum }, each outcome { flows, times, perDriver, total }.
export function outcomes(scene, roads, demand) {
  const routeList = routes(scene, roads);
  const describe = (flows) => {
    const times = routeTimes(roads, routeList, flows);
    const total = totalTime(roads, routeList, flows);
    const used = times.filter((_, i) => flows[i] > 1e-6 * Math.max(1, demand));
    const perDriver = demand > 0 ? total / demand : Math.min(...times);
    return { flows, times, total, perDriver, slowestUsed: used.length ? Math.max(...used) : perDriver };
  };
  return {
    routes: routeList,
    equilibrium: describe(split(roads, routeList, demand, 1)),
    optimum: describe(split(roads, routeList, demand, 2)),
  };
}

// Minutes per driver at equilibrium and at the optimum across a range of demand.
export function sweep(scene, roads, from, to, samples) {
  const out = [];
  for (let i = 0; i <= samples; i++) {
    const d = from + ((to - from) * i) / samples;
    const o = outcomes(scene, roads, d);
    out.push({ demand: d, equilibrium: o.equilibrium.perDriver, optimum: o.optimum.perDriver });
  }
  return out;
}
