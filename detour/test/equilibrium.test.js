import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcomes, sweep, solveLinear, projectToSimplex } from '../src/equilibrium.js';
import { openRoads, routes, routeName, routeTimes } from '../src/network.js';
import { sceneById, SCENES } from '../src/scenes.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const braess = sceneById('braess');
const closed = openRoads(braess, new Set());
const opened = openRoads(braess, new Set(['AB']));

test('routes are read off the open roads', () => {
  assert.deepEqual(routes(braess, closed).map((r) => routeName(braess, r)), ['S → A → T', 'S → B → T']);
  assert.deepEqual(routes(braess, opened).map((r) => routeName(braess, r)), ['S → A → T', 'S → A → B → T', 'S → B → T']);
  const ladder = sceneById('ladder');
  assert.equal(routes(ladder, openRoads(ladder, new Set(['AB', 'DC']))).length, 5);
});

test("Braess's numbers: 4000 drivers take 65 minutes, and 80 once the link opens", () => {
  const before = outcomes(braess, closed, 4000);
  near(before.equilibrium.perDriver, 65);
  assert.deepEqual(before.equilibrium.flows.map(Math.round), [2000, 2000]);
  const after = outcomes(braess, opened, 4000);
  near(after.equilibrium.perDriver, 80);
  assert.deepEqual(after.equilibrium.flows.map(Math.round), [0, 4000, 0]);
  // Nobody can do better alone: the routes left empty take 85 minutes.
  after.equilibrium.times.forEach((t) => assert.ok(t >= 80 - 1e-9));
});

test('the paradox holds between 3000 and 9000 drivers, as the algebra says', () => {
  for (const d of [1000, 2900, 3100, 4500, 6000, 8900, 9100, 10000]) {
    const worse = outcomes(braess, opened, d).equilibrium.perDriver > outcomes(braess, closed, d).equilibrium.perDriver + 1e-9;
    assert.equal(worse, d > 3000 && d < 9000, `demand ${d}`);
  }
  // Above 4500 the drivers spread over all three routes and every route in use takes 90 minutes.
  const mixed = outcomes(braess, opened, 6000).equilibrium;
  assert.deepEqual(mixed.flows.map(Math.round), [1500, 3000, 1500]);
  mixed.times.forEach((t) => near(t, 90));
});

test("Pigou's roads: equilibrium is 4/3 of the optimum at 6000 drivers", () => {
  const pigou = sceneById('pigou');
  const o = outcomes(pigou, pigou.roads, 6000);
  near(o.equilibrium.perDriver, 60);
  near(o.optimum.perDriver, 45);
  assert.deepEqual(o.optimum.flows.map(Math.round), [3000, 3000]);
  near(o.equilibrium.perDriver / o.optimum.perDriver, 4 / 3);
});

test('equilibrium conditions hold in every scene and every set of open roads', () => {
  for (const scene of SCENES) {
    const opts = scene.roads.filter((r) => r.optional).map((r) => r.id);
    const subsets = [[]];
    for (const id of opts) for (const s of [...subsets]) subsets.push([...s, id]);
    for (const sub of subsets) {
      const roads = openRoads(scene, new Set(sub));
      for (const d of [0, 1500, scene.demand, scene.maxDemand]) {
        const o = outcomes(scene, roads, d);
        const { flows, times } = o.equilibrium;
        near(flows.reduce((s, f) => s + f, 0), d, 1e-6 * Math.max(1, d));
        flows.forEach((f) => assert.ok(f >= 0));
        const fastest = Math.min(...times);
        times.forEach((t, i) => {
          if (flows[i] > 1e-6 * d) near(t, fastest, 1e-6 * Math.max(1, fastest));
        });
        assert.ok(o.optimum.total <= o.equilibrium.total + 1e-6 * Math.max(1, o.equilibrium.total));
        // Roughgarden and Tardos: with linear travel times selfish routing costs at most 4/3 of the optimum.
        if (d > 0) assert.ok(o.equilibrium.total <= (4 / 3) * o.optimum.total * (1 + 1e-9));
      }
    }
  }
});

test('the optimum is not beaten by nearby splits', () => {
  const o = outcomes(braess, opened, 4000);
  const base = o.optimum.flows;
  for (let i = 0; i < base.length; i++) {
    for (let j = 0; j < base.length; j++) {
      if (i === j || base[i] < 10) continue;
      const f = base.slice();
      f[i] -= 10;
      f[j] += 10;
      const t = routeTimes(opened, o.routes, f).reduce((s, ti, k) => s + ti * f[k], 0);
      assert.ok(t >= o.optimum.total - 1e-6);
    }
  }
});

test('sweep gives one sample per step, ending at the top demand', () => {
  const s = sweep(braess, closed, 0, 10000, 50);
  assert.equal(s.length, 51);
  near(s[50].demand, 10000);
  near(s[50].equilibrium, 95);
  near(s[0].equilibrium, 45);
});

test('linear solver and simplex projection', () => {
  assert.deepEqual(solveLinear([[2, 1], [1, 3]], [3, 5]).map((x) => +x.toFixed(9)), [0.8, 1.4]);
  assert.equal(solveLinear([[1, 1], [2, 2]], [1, 2]), null);
  const p = projectToSimplex([3, -1, 1], 2);
  near(p.reduce((s, x) => s + x, 0), 2);
  assert.deepEqual(p.map((x) => +x.toFixed(9)), [2, 0, 0]);
});
