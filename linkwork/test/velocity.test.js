import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, crankArc } from '../src/linkage.js';
import { velocities, speedColor, speedRange } from '../src/velocity.js';

const links = [
  { A: { x: 0, y: 0 }, D: { x: 4, y: 0 }, a: 1.5, b: 4, c: 3, u: 1.5, v: 1.6 },
  { A: { x: 0, y: 0 }, D: { x: 1, y: 0 }, a: 3, b: 3.5, c: 2.5, u: 1.2, v: 1.4 },
  { A: { x: -1, y: 0.5 }, D: { x: 2.5, y: -0.3 }, a: 3.2, b: 1.4, c: 2.6, u: -0.7, v: 0.9 },
];

const angle = (p, q) => Math.atan2(q.y - p.y, q.x - p.x);
const unwrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));

test('analytic velocities match central differences', () => {
  const h = 1e-6;
  let checked = 0;
  for (const link of links) {
    for (let k = 0; k < 72; k++) {
      const t = (k * Math.PI) / 36;
      for (const br of [1, -1]) {
        const p = solve(link, t, br);
        const lo = solve(link, t - h, br);
        const hi = solve(link, t + h, br);
        if (!p || !lo || !hi) continue;
        const arc = crankArc(link, t);
        if (!arc.full && Math.min(t - arc.lo, arc.hi - t) < 0.05) continue;
        const v = velocities(link, p);
        const w3 = unwrap(angle(hi.B, hi.C) - angle(lo.B, lo.C)) / (2 * h);
        const w4 = unwrap(angle(link.D, hi.C) - angle(link.D, lo.C)) / (2 * h);
        const tol = 1e-5 * (1 + Math.abs(w3) + Math.abs(w4));
        assert.ok(Math.abs(v.w3 - w3) < tol, `w3 ${v.w3} vs ${w3}`);
        assert.ok(Math.abs(v.w4 - w4) < tol, `w4 ${v.w4} vs ${w4}`);
        assert.ok(Math.abs(v.vP.x - (hi.P.x - lo.P.x) / (2 * h)) < 1e-4 * (1 + v.speed));
        assert.ok(Math.abs(v.vP.y - (hi.P.y - lo.P.y) / (2 * h)) < 1e-4 * (1 + v.speed));
        checked++;
      }
    }
  }
  assert.ok(checked > 200);
});

test('velocities scale with the crank speed and the rocker point moves square to the rocker', () => {
  const link = links[0];
  const p = solve(link, 0.7, 1);
  const one = velocities(link, p, 1);
  const three = velocities(link, p, 3);
  assert.ok(Math.abs(three.w4 - 3 * one.w4) < 1e-12);
  const r4 = { x: p.C.x - link.D.x, y: p.C.y - link.D.y };
  assert.ok(Math.abs(one.vC.x * r4.x + one.vC.y * r4.y) < 1e-12);
});

test('at a toggle the velocities are undefined', () => {
  const link = { A: { x: 0, y: 0 }, D: { x: 4, y: 0 }, a: 5, b: 2, c: 5, u: 1, v: 0 };
  const arc = crankArc(link, Math.PI / 2);
  assert.equal(velocities(link, solve(link, arc.hi, 1)), null);
});

test('speed colours run from blue to yellow and clamp outside the range', () => {
  assert.equal(speedColor(0, 0, 1), 'rgb(64, 80, 190)');
  assert.equal(speedColor(1, 0, 1), 'rgb(253, 231, 37)');
  assert.equal(speedColor(-5, 0, 1), speedColor(0, 0, 1));
  assert.equal(speedColor(9, 0, 1), speedColor(1, 0, 1));
});

test('the speed range ignores the spike next to a toggle', () => {
  const speeds = Array.from({ length: 100 }, (_, i) => 1 + i / 100);
  speeds.push(1e6, Infinity);
  const { lo, hi } = speedRange(speeds);
  assert.equal(lo, 1);
  assert.ok(hi < 2);
});
