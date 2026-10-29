import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycle, solve, branchOf } from '../src/linkage.js';
import { cognatePose, cognateLinks, thirdPivot } from '../src/cognates.js';
import { PRESETS } from '../src/presets.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const spread = (xs) => Math.max(...xs) - Math.min(...xs);

const startAngle = (link) => {
  for (let k = 0; k < 360; k++) if (solve(link, 1.2 + (k * Math.PI) / 180, 1)) return 1.2 + (k * Math.PI) / 180;
  throw new Error('no pose');
};

const links = [
  { A: { x: 0, y: 0 }, D: { x: 4, y: 0 }, a: 1.5, b: 4, c: 3, u: 1.5, v: 1.6 },
  { A: { x: -1, y: 0.5 }, D: { x: 2.5, y: -0.3 }, a: 3.2, b: 1.4, c: 2.6, u: -0.7, v: 0.9 },
  { A: { x: 0, y: 0 }, D: { x: 4.5, y: 0 }, a: 2.6, b: 2.6, c: 2.6, u: 1.3, v: 1.2 },
];

test('every cognate bar keeps its length through a whole cycle', () => {
  for (const link of links) {
    const { poses } = cycle(link, startAngle(link), 1, 240);
    const O = thirdPivot(link);
    const rows = poses.map((p) => {
      const k = cognatePose(link, p);
      return [dist(k.E, link.A), dist(k.G, k.E), dist(k.G, O), dist(k.F, link.D), dist(k.H, k.F), dist(k.H, O)];
    });
    for (let j = 0; j < 6; j++) assert.ok(spread(rows.map((r) => r[j])) < 1e-9, `bar ${j}`);
  }
});

test('the coupler point sits rigidly on both cognate couplers', () => {
  const link = links[1];
  const { poses } = cycle(link, startAngle(link), -1, 120);
  const rows = poses.map((p) => {
    const k = cognatePose(link, p);
    return [dist(p.P, k.E), dist(p.P, k.G), dist(p.P, k.F), dist(p.P, k.H)];
  });
  for (let j = 0; j < 4; j++) assert.ok(spread(rows.map((r) => r[j])) < 1e-9, `side ${j}`);
});

test('the three fixed pivots form a triangle similar to the coupler triangle', () => {
  const link = links[0];
  const p = solve(link, 1, 1);
  const O = thirdPivot(link);
  const r = dist(link.A, link.D) / dist(p.B, p.C);
  close(dist(link.A, O), r * dist(p.B, p.P), 1e-12);
  close(dist(link.D, O), r * dist(p.C, p.P), 1e-12);
});

test('each cognate, solved on its own, retraces the same coupler curve', () => {
  for (const link of links) {
    const t0 = startAngle(link);
    const start = solve(link, t0, 1);
    const curve = cycle(link, t0, 1, 1500).poses.map((p) => p.P);
    for (const cog of cognateLinks(link, start)) {
      const theta = Math.atan2(cog.B.y - cog.link.A.y, cog.B.x - cog.link.A.x);
      const branch = branchOf(cog.B, cog.C, cog.link.D);
      const own = solve(cog.link, theta, branch);
      close(dist(own.P, start.P), 0, 1e-9, 'starts at P');
      const traced = cycle(cog.link, theta, branch, 1500).poses.map((p) => p.P);
      const gap = Math.max(...traced.map((q) => Math.min(...curve.map((c) => dist(c, q)))));
      assert.ok(gap < 0.03, `gap ${gap}`);
    }
  }
});

test("both cognates of Chebyshev's linkage are the lambda linkage", () => {
  const cheb = PRESETS.find((p) => p.id === 'chebyshev');
  const lambda = PRESETS.find((p) => p.id === 'lambda').link;
  const [one, two] = cognateLinks(cheb.link, solve(cheb.link, cheb.theta, cheb.branch));
  close(one.link.D.x, lambda.D.x, 1e-12);
  close(one.link.D.y, lambda.D.y, 1e-12);
  for (const k of ['a', 'b', 'c', 'u', 'v']) close(one.link[k], lambda[k], 1e-12, k);
  // the other cognate is its mirror image, pivoted at D and O
  close(two.link.A.x, 4, 1e-12);
  close(Math.hypot(two.link.D.x - two.link.A.x, two.link.D.y - two.link.A.y), 2, 1e-12);
  for (const k of ['a', 'b', 'c', 'u']) close(two.link[k], lambda[k], 1e-12, k);
  close(Math.abs(two.link.v), 0, 1e-12);
});
