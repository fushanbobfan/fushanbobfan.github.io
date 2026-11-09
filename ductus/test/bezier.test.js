import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deCasteljau, pointAt, split, hodograph, derivative, curvature, normal, elevate, arcLength,
} from '../src/bezier.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const closePt = (p, q, eps = 1e-9) => { close(p.x, q.x, eps); close(p.y, q.y, eps); };

const cubic = [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 0 }];

function bernstein(points, t) {
  const n = points.length - 1;
  let x = 0, y = 0, c = 1;
  for (let i = 0; i <= n; i++) {
    if (i > 0) c = c * (n - i + 1) / i;
    const b = c * Math.pow(t, i) * Math.pow(1 - t, n - i);
    x += b * points[i].x;
    y += b * points[i].y;
  }
  return { x, y };
}

test('de Casteljau shrinks by one point per level and matches the Bernstein form', () => {
  const levels = deCasteljau(cubic, 0.3);
  assert.deepEqual(levels.map((l) => l.length), [4, 3, 2, 1]);
  for (const t of [0, 0.1, 0.5, 0.77, 1]) closePt(pointAt(cubic, t), bernstein(cubic, t));
});

test('the curve starts and ends at the end control points', () => {
  closePt(pointAt(cubic, 0), cubic[0]);
  closePt(pointAt(cubic, 1), cubic[3]);
});

test('splitting gives two curves that trace the two halves exactly', () => {
  const { left, right } = split(cubic, 0.4);
  assert.equal(left.length, 4);
  assert.equal(right.length, 4);
  for (const s of [0, 0.25, 0.6, 1]) {
    closePt(pointAt(left, s), pointAt(cubic, 0.4 * s));
    closePt(pointAt(right, s), pointAt(cubic, 0.4 + 0.6 * s));
  }
});

test('the derivative matches a central difference and the end tangents follow the polygon', () => {
  const h = 1e-6;
  for (const t of [0.2, 0.5, 0.9]) {
    const a = pointAt(cubic, t - h), b = pointAt(cubic, t + h);
    closePt(derivative(cubic, t), { x: (b.x - a.x) / (2 * h), y: (b.y - a.y) / (2 * h) }, 1e-5);
  }
  closePt(derivative(cubic, 0), { x: 3, y: 6 });
  assert.equal(hodograph(cubic).length, 3);
});

test('a circle-like arc has nearly constant curvature, a straight line none', () => {
  // The standard cubic approximation of a quarter of the unit circle.
  const k = 0.5522847498;
  const arc = [{ x: 1, y: 0 }, { x: 1, y: k }, { x: k, y: 1 }, { x: 0, y: 1 }];
  for (const t of [0, 0.25, 0.5, 0.75, 1]) close(curvature(arc, t), 1, 2.5e-2);
  // At the ends the exact value is (2/3)(1 - k) / k^2.
  close(curvature(arc, 0), (2 / 3) * (1 - k) / (k * k), 1e-9);
  const line = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }];
  close(curvature(line, 0.3), 0);
});

test('curvature changes sign through the inflection of an S curve', () => {
  const s = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: -1 }, { x: 3, y: 0 }];
  assert.ok(curvature(s, 0.1) * curvature(s, 0.9) < 0);
  close(curvature(s, 0.5), 0);
});

test('the normal is a unit vector at right angles to the tangent', () => {
  const n = normal(cubic, 0.3);
  const d = derivative(cubic, 0.3);
  close(Math.hypot(n.x, n.y), 1);
  close(n.x * d.x + n.y * d.y, 0);
});

test('degree elevation adds a control point and leaves the curve unchanged', () => {
  let pts = cubic;
  for (let k = 0; k < 3; k++) {
    const up = elevate(pts);
    assert.equal(up.length, pts.length + 1);
    for (const t of [0, 0.33, 0.5, 0.9, 1]) closePt(pointAt(up, t), pointAt(pts, t));
    pts = up;
  }
});

test('arc length of a straight segment and of the quarter-circle cubic', () => {
  close(arcLength([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 3, y: 3 }]), 3 * Math.SQRT2, 1e-9);
  const k = 0.5522847498;
  const arc = [{ x: 1, y: 0 }, { x: 1, y: k }, { x: k, y: 1 }, { x: 0, y: 1 }];
  close(arcLength(arc), Math.PI / 2, 1e-3);
});
