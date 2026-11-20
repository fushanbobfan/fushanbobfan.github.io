import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marginalTolls, tolledOutcome } from '../src/tolls.js';
import { outcomes } from '../src/equilibrium.js';
import { openRoads, roadFlows } from '../src/network.js';
import { sceneById, SCENES } from '../src/scenes.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);

test("Pigou: a 30-minute toll on the narrow road sends half the drivers to the highway", () => {
  const pigou = sceneById('pigou');
  const tolls = marginalTolls(pigou, pigou.roads, 6000);
  near(tolls.get('lo'), 30);
  near(tolls.get('hi'), 0);
  const t = tolledOutcome(pigou, pigou.roads, 6000);
  assert.deepEqual(t.flows.map(Math.round), [3000, 3000]);
  near(t.perDriver, 45);
  near(t.tollPerDriver, 15);
});

test("Braess with the link open: tolls bring trips back to the best split's 64.7 minutes", () => {
  const braess = sceneById('braess');
  const roads = openRoads(braess, new Set(['AB']));
  const t = tolledOutcome(braess, roads, 4000);
  near(t.perDriver, outcomes(braess, roads, 4000).optimum.perDriver);
  assert.ok(t.perDriver < 65);
});

test('in every scene and road set, tolled drivers reach the least total time', () => {
  for (const scene of SCENES) {
    const opts = scene.roads.filter((r) => r.optional).map((r) => r.id);
    const subsets = [[]];
    for (const id of opts) for (const s of [...subsets]) subsets.push([...s, id]);
    for (const sub of subsets) {
      const roads = openRoads(scene, new Set(sub));
      for (const d of [500, 2000, scene.demand, scene.maxDemand]) {
        const t = tolledOutcome(scene, roads, d);
        const o = outcomes(scene, roads, d);
        near(t.total, o.optimum.total, 1e-6 * o.optimum.total);
        // Crowdable roads carry the same traffic as in the best split.
        const xt = roadFlows(roads, t.routes, t.flows);
        const xo = roadFlows(roads, o.routes, o.optimum.flows);
        for (const r of roads) if (r.b > 0) near(xt.get(r.id), xo.get(r.id), 1e-6 * d);
        // Every route in use costs the same time plus toll.
        const cost = t.times.map((x, i) => x + t.tolls[i]);
        const least = Math.min(...cost);
        cost.forEach((c, i) => {
          if (t.flows[i] > 1e-6 * d) near(c, least, 1e-6 * Math.max(1, least));
        });
      }
    }
  }
});

test('no drivers, no tolls', () => {
  const braess = sceneById('braess');
  const t = tolledOutcome(braess, openRoads(braess, new Set(['AB'])), 0);
  assert.equal(t.tollPerDriver, 0);
  [...t.roadTolls.values()].forEach((v) => assert.equal(v, 0));
});
