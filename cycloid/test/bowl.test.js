import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, traverse } from '../src/motion.js';
import { BOWL_R, BOWL_CX, bowlPoint, bowlPoints, swingPoints, ellipticK, timeToBottom, nearestS } from '../src/bowl.js';
import { WORLD } from '../src/scene.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const starts = [-0.95, -0.7, -0.4, -0.15, 0.3, 0.8];

test('both bowls have their bottom at (cx, 2r) and their rims level with A', () => {
  for (const kind of ['cycloid', 'circle']) {
    const [bx, by] = bowlPoint(kind, 0);
    close(bx, BOWL_CX, 1e-12);
    close(by, 2 * BOWL_R, 1e-12);
    close(bowlPoint(kind, -1)[1], 0, 1e-12, kind);
    close(bowlPoint(kind, 1)[1], 0, 1e-12, kind);
  }
});

test('both bowls fit on the stage', () => {
  for (const kind of ['cycloid', 'circle']) {
    const pts = bowlPoints(kind);
    for (let i = 0; i < pts.length; i += 2) {
      assert.ok(pts[i] > WORLD.x0 && pts[i] < WORLD.x1, kind);
      assert.ok(pts[i + 1] > WORLD.y0 && pts[i + 1] < WORLD.y1, kind);
    }
  }
});

test('the circle has the cycloid\'s curvature at the bottom', () => {
  // radius of curvature from three close points
  const radius = (kind) => {
    const h = 1e-4;
    const [x0, y0] = bowlPoint(kind, -h), [x1, y1] = bowlPoint(kind, 0), [x2, y2] = bowlPoint(kind, h);
    const a = Math.hypot(x1 - x0, y1 - y0), b = Math.hypot(x2 - x1, y2 - y1), c = Math.hypot(x2 - x0, y2 - y0);
    const area = Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2;
    return (a * b * c) / (4 * area);
  };
  close(radius('cycloid'), 4 * BOWL_R, 1e-4);
  close(radius('circle'), 4 * BOWL_R, 1e-4);
});

test('a swing ends at the mirror point, level with the release', () => {
  const { pts, bottom } = swingPoints('cycloid', -0.6);
  const n = pts.length / 2;
  close(pts[2 * n - 1], pts[1], 1e-12);
  close(pts[2 * bottom], BOWL_CX, 1e-12);
});

test('elliptic K: K(0) = pi/2 and K(1/sqrt 2) = Gamma(1/4)^2 / (4 sqrt pi)', () => {
  close(ellipticK(0), Math.PI / 2, 1e-15);
  const gammaQuarter = 3.625609908221908;
  close(ellipticK(Math.SQRT1_2), (gammaQuarter * gammaQuarter) / (4 * Math.sqrt(Math.PI)), 1e-12);
});

test('on the cycloid every start reaches the bottom in pi sqrt(r/g)', () => {
  const exact = Math.PI * Math.sqrt(BOWL_R / G);
  for (const s0 of starts) {
    close(timeToBottom('cycloid', s0), exact, 1e-15);
    const { pts, bottom } = swingPoints('cycloid', s0, 3000);
    close(traverse(pts).times[bottom], exact, 1e-3 * exact, `s0=${s0}`);
  }
});

test('on the circle the polyline matches the pendulum quarter period', () => {
  for (const s0 of starts) {
    const { pts, bottom } = swingPoints('circle', s0, 3000);
    const exact = timeToBottom('circle', s0);
    close(traverse(pts).times[bottom], exact, 1e-3 * exact, `s0=${s0}`);
  }
});

test('the circle agrees with the cycloid for small swings and lags for large ones', () => {
  const tau = Math.PI * Math.sqrt(BOWL_R / G);
  close(timeToBottom('circle', 1e-6), tau, 1e-12);
  let prev = tau;
  for (const s0 of [0.2, 0.5, 0.8, 1]) {
    const t = timeToBottom('circle', s0);
    assert.ok(t > prev);
    prev = t;
  }
  assert.ok(timeToBottom('circle', 1) > 1.07 * tau);
});

test('a swing returns to its start after twice the half-swing time', () => {
  const { pts } = swingPoints('cycloid', -0.8, 2000);
  const path = traverse(pts);
  close(path.total, 2 * timeToBottom('cycloid', -0.8), 2e-3 * path.total);
});

test('nearestS finds the point on the bowl', () => {
  const [x, y] = bowlPoint('cycloid', -0.5);
  close(nearestS('cycloid', x, y + 0.01).s, -0.5, 0.01);
  assert.ok(nearestS('circle', 2, -3).distance > 1);
});
