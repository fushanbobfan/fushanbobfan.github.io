import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, crankArc, cycle, step, couplerOffsets, branchOf } from '../src/linkage.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

const crankRocker = { A: { x: 0, y: 0 }, D: { x: 4, y: 0 }, a: 1.5, b: 4, c: 3, u: 1.5, v: 1 };
const doubleRocker = { A: { x: 0, y: 0 }, D: { x: 4, y: 0 }, a: 5, b: 2, c: 5, u: 1, v: 0 };

test('every solved pose keeps all four bar lengths', () => {
  for (const link of [crankRocker, doubleRocker]) {
    const { poses } = cycle(link, Math.PI / 2, 1, 360);
    assert.ok(poses.length > 300);
    for (const p of poses) {
      close(dist(link.A, p.B), link.a, 1e-9);
      close(dist(p.B, p.C), link.b, 1e-9);
      close(dist(link.D, p.C), link.c, 1e-9);
    }
  }
});

test('the coupler point rides rigidly with the coupler', () => {
  const { poses } = cycle(crankRocker, 0, -1, 90);
  const r = Math.hypot(crankRocker.u, crankRocker.v);
  const rc = Math.hypot(crankRocker.b - crankRocker.u, crankRocker.v);
  for (const p of poses) {
    close(dist(p.B, p.P), r, 1e-9);
    close(dist(p.C, p.P), rc, 1e-9);
  }
});

test('the two branches are mirror images across the line BD', () => {
  const up = solve(crankRocker, 1, 1);
  const down = solve(crankRocker, 1, -1);
  assert.equal(branchOf(up.B, up.C, crankRocker.D), 1);
  assert.equal(branchOf(down.B, down.C, crankRocker.D), -1);
  close(dist(up.C, crankRocker.D), dist(down.C, crankRocker.D), 1e-12);
  close(dist(up.C, up.B), dist(down.C, down.B), 1e-12);
});

test('couplerOffsets inverts the coupler point placement', () => {
  const p = solve(crankRocker, 2.2, 1);
  const { u, v } = couplerOffsets(p.B, p.C, p.P);
  close(u, crankRocker.u, 1e-12);
  close(v, crankRocker.v, 1e-12);
});

test('a crank-rocker crank turns all the way round', () => {
  assert.deepEqual(crankArc(crankRocker, 0.3), { full: true });
});

test('a crank that cannot turn stops where coupler and rocker line up', () => {
  const arc = crankArc(doubleRocker, Math.PI / 2);
  assert.equal(arc.full, false);
  assert.ok(arc.lo < Math.PI / 2 && Math.PI / 2 < arc.hi);
  for (const t of [arc.lo, arc.hi]) {
    const p = solve(doubleRocker, t, 1);
    const bd = dist(p.B, doubleRocker.D);
    const toggled = Math.abs(bd - (doubleRocker.b + doubleRocker.c)) < 1e-6 || Math.abs(bd - Math.abs(doubleRocker.b - doubleRocker.c)) < 1e-6;
    assert.ok(toggled, `|BD| = ${bd}`);
    assert.equal(solve(doubleRocker, t + (t === arc.hi ? 1e-3 : -1e-3), 1), null);
  }
});

test('the arc is found from either side of the ground line', () => {
  const arcUp = crankArc(doubleRocker, Math.PI / 2);
  const arcDown = crankArc(doubleRocker, -Math.PI / 2);
  close(arcDown.lo, -arcUp.hi, 1e-12);
  close(arcDown.hi, -arcUp.lo, 1e-12);
});

test('a loop that cannot close has no arc', () => {
  const broken = { ...crankRocker, b: 0.5, c: 0.5 };
  assert.equal(crankArc(broken, 0), null);
  assert.equal(cycle(broken, 0), null);
});

test('stepping a rocking input bounces at the toggles and flips the branch', () => {
  const arc = crankArc(doubleRocker, Math.PI / 2);
  let s = { theta: Math.PI / 2, branch: 1, dir: 1 };
  s = step(doubleRocker, s, arc.hi - Math.PI / 2 + 0.1);
  close(s.theta, arc.hi - 0.1, 1e-12);
  assert.equal(s.dir, -1);
  assert.equal(s.branch, -1);
  assert.ok(solve(doubleRocker, s.theta, s.branch));
});

test('motion through a toggle is continuous', () => {
  const arc = crankArc(doubleRocker, Math.PI / 2);
  const before = solve(doubleRocker, arc.hi - 1e-10, 1);
  const after = solve(doubleRocker, arc.hi - 1e-10, -1);
  close(dist(before.C, after.C), 0, 1e-3);
});

test('a rocking cycle closes on itself', () => {
  const { poses } = cycle(doubleRocker, Math.PI / 2, 1, 2000);
  const first = poses[0];
  const last = poses[poses.length - 1];
  assert.ok(dist(first.P, last.P) < 0.05);
  for (let i = 1; i < poses.length; i++) assert.ok(dist(poses[i - 1].P, poses[i].P) < 0.1, `jump at ${i}`);
});
