import { test } from 'node:test';
import assert from 'node:assert/strict';
import { antisolarAngle, bowTop, bowSpan, project, unproject } from '../src/sky.js';

const R = Math.PI / 180;

test('the antisolar point is as far below the horizon as the sun is above', () => {
  for (const h of [0, 10, 35]) {
    assert.ok(antisolarAngle(0, -h * R, h * R) < 1e-7);
    assert.ok(Math.abs(antisolarAngle(0, 0, h * R) - h * R) < 1e-12);
  }
});

test('straight up is 90° plus the sun\'s elevation from the antisolar point', () => {
  assert.ok(Math.abs(antisolarAngle(0, Math.PI / 2, 20 * R) - 110 * R) < 1e-12);
});

test('the top of the bow and its foot on the horizon lie on the bow', () => {
  const alpha = 42 * R;
  for (const h of [0, 15, 30]) {
    const top = bowTop(alpha, h * R);
    assert.ok(Math.abs(antisolarAngle(0, top, h * R) - alpha) < 1e-12);
    const span = bowSpan(alpha, h * R);
    assert.ok(Math.abs(antisolarAngle(span, 0, h * R) - alpha) < 1e-12);
  }
});

test('with the sun at 0° the bow is a half circle, and above 42° it is gone', () => {
  assert.ok(Math.abs(bowSpan(42 * R, 0) - 42 * R) < 1e-12);
  assert.equal(bowSpan(42 * R, 45 * R), 0);
  assert.ok(bowTop(42 * R, 45 * R) < 0);
});

test('the projection round-trips and keeps the bow a circle on the page', () => {
  const el0 = 18 * R;
  for (const [az, el] of [[0, 0], [0.7, 0.3], [-1.1, -0.2], [0.2, 1.1]]) {
    const [x, y] = project(az, el, el0);
    const [a2, e2] = unproject(x, y, el0);
    assert.ok(Math.abs(a2 - az) < 1e-12 && Math.abs(e2 - el) < 1e-12);
  }
  const sun = 12 * R;
  const alpha = 42 * R;
  const pts = [];
  for (let j = 0; j < 12; j++) {
    const psi = (j / 12) * 2 * Math.PI;
    const a = -sun;
    const x = Math.cos(a) * Math.cos(alpha) - Math.sin(a) * Math.sin(alpha) * Math.cos(psi);
    const y = Math.sin(alpha) * Math.sin(psi);
    const z = Math.sin(a) * Math.cos(alpha) + Math.cos(a) * Math.sin(alpha) * Math.cos(psi);
    const az = Math.atan2(y, x);
    const el = Math.asin(z);
    assert.ok(Math.abs(antisolarAngle(az, el, sun) - alpha) < 1e-12);
    pts.push(project(az, el, el0));
  }
  // Circumcentre of three points, then every point at the same distance.
  const [[ax, ay], [bx, by], [cx, cy]] = [pts[0], pts[4], pts[8]];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r0 = Math.hypot(ax - ux, ay - uy);
  for (const [px, py] of pts) assert.ok(Math.abs(Math.hypot(px - ux, py - uy) - r0) < 1e-9);
});
