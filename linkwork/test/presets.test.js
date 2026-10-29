import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS } from '../src/presets.js';
import { solve, cycle, ground } from '../src/linkage.js';
import { classify } from '../src/grashof.js';

const byId = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
const types = (id) => {
  const { link } = byId[id];
  return classify({ a: link.a, b: link.b, c: link.c, g: ground(link).g }).type;
};

test('every preset assembles in its starting pose', () => {
  for (const p of PRESETS) assert.ok(solve(p.link, p.theta, p.branch), p.id);
});

test('each preset is the kind of linkage its note describes', () => {
  assert.equal(types('loop'), 'crank-rocker');
  assert.equal(types('chebyshev'), 'double-rocker');
  assert.equal(types('lambda'), 'crank-rocker');
  assert.equal(types('drag'), 'double-crank');
  assert.equal(types('triple'), 'triple-rocker');
});

test('the Chebyshev linkage starts crossed with the coupler midpoint at (2, 4)', () => {
  const p = solve(byId.chebyshev.link, byId.chebyshev.theta, byId.chebyshev.branch);
  assert.ok(Math.abs(p.P.x - 2) < 1e-12 && Math.abs(p.P.y - 4) < 1e-12);
});

test("Watt's linkage starts with both rockers level and the coupler upright", () => {
  const p = solve(byId.watt.link, 0, byId.watt.branch);
  assert.ok(Math.abs(p.C.x) < 1e-12 && Math.abs(p.C.y + 0.5) < 1e-12);
});

test('the straight stretch of the Chebyshev curve stays within 0.4% of the bar length', () => {
  const { poses } = cycle(byId.chebyshev.link, byId.chebyshev.theta, byId.chebyshev.branch, 4000);
  const flat = poses.filter((p) => p.P.x > 0 && p.P.x < 4 && p.P.y < 4.3);
  const xs = flat.map((p) => p.P.x);
  const ys = flat.map((p) => p.P.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 3.9);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 0.02);
});

test('the lambda linkage traces the same curve as the Chebyshev linkage', () => {
  const cheb = cycle(byId.chebyshev.link, byId.chebyshev.theta, byId.chebyshev.branch, 3000).poses.map((p) => p.P);
  const lam = cycle(byId.lambda.link, byId.lambda.theta, byId.lambda.branch, 3000).poses.map((p) => p.P);
  const gap = (from, to) => Math.max(...from.map((p) => Math.min(...to.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))));
  assert.ok(gap(cheb, lam) < 0.02);
  assert.ok(gap(lam, cheb) < 0.02);
});
