import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, traverse } from '../src/motion.js';
import {
  cycloidThrough, cycloidPoints, cycloidTime, cycloidDepth,
  linePoints, lineTime, arcPoints, parabolaPoints, CURVES,
} from '../src/curves.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const ends = [[2, 1], [1, 1], [0.5, 2], [3, 0.8], [3.5, 0.5], [Math.PI / 2, 1]];

test('the cycloid passes through B', () => {
  for (const [bx, by] of ends) {
    const { r, theta } = cycloidThrough(bx, by);
    close(r * (theta - Math.sin(theta)), bx, 1e-12);
    close(r * (1 - Math.cos(theta)), by, 1e-12);
  }
});

test('B level with the lowest point puts the end at t = pi', () => {
  const { r, theta } = cycloidThrough(Math.PI, 2);
  close(theta, Math.PI, 1e-12);
  close(r, 1, 1e-12);
  close(cycloidDepth(Math.PI, 2), 2, 1e-12);
});

test('a far, shallow B makes the cycloid dip below it', () => {
  assert.ok(cycloidDepth(3.5, 0.5) > 0.5);
  close(cycloidDepth(1, 1), 1, 0);
});

test('the bead on the cycloid polyline matches theta sqrt(r/g)', () => {
  for (const [bx, by] of ends) {
    const exact = cycloidTime(bx, by);
    close(traverse(cycloidPoints(bx, by, 4000)).total, exact, 2e-4 * exact, `B=(${bx},${by})`);
  }
});

test('the straight ramp matches its closed form', () => {
  for (const [bx, by] of ends) close(traverse(linePoints(bx, by)).total, lineTime(bx, by), 1e-12);
});

test('every curve starts at A and ends at B', () => {
  for (const c of CURVES) {
    const pts = c.points(2, 1);
    assert.equal(pts[0], 0);
    assert.equal(pts[1], 0);
    close(pts[pts.length - 2], 2, 1e-12, c.id);
    close(pts[pts.length - 1], 1, 1e-12, c.id);
  }
});

test('the arc leaves A vertically and stays on its circle', () => {
  const pts = arcPoints(2, 1);
  const R = 5 / 4;
  for (let i = 0; i < pts.length; i += 2) close(Math.hypot(pts[i] - R, pts[i + 1]), R, 1e-12);
  assert.ok(pts[2] < 0.01 * pts[3]);
});

test('the cycloid beats the arc, the parabola and the ramp', () => {
  for (const [bx, by] of ends) {
    const t = Object.fromEntries(CURVES.map((c) => [c.id, traverse(c.points(bx, by, 3000)).total]));
    for (const id of ['arc', 'parabola', 'line']) assert.ok(t.cycloid < t[id], `B=(${bx},${by}) ${id}`);
    // Galileo was right that the arc beats the chord
    assert.ok(t.arc < t.line, `B=(${bx},${by})`);
  }
});

test('the parabola uses x = bx (y/by)^2', () => {
  const pts = parabolaPoints(2, 1, 4);
  close(pts[4], 2 * 0.25, 1e-12);
  close(pts[5], 0.5, 1e-12);
});

test('time scales with sqrt(size / g)', () => {
  close(cycloidTime(4, 2), Math.SQRT2 * cycloidTime(2, 1), 1e-12);
  close(cycloidTime(2, 1, G / 4), 2 * cycloidTime(2, 1), 1e-12);
});
