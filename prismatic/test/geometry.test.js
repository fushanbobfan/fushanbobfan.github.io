import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vec, segment, arc, hitSegment, hitArc, normalAt, polygon, rotate, wrapAngle,
} from '../src/geometry.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('ray meets a segment at the expected distance', () => {
  const s = segment(vec(5, -1), vec(5, 1), vec(-1, 0));
  close(hitSegment(vec(0, 0), vec(1, 0), s), 5);
});

test('ray misses a segment it is parallel to, behind, or beside', () => {
  const s = segment(vec(5, -1), vec(5, 1), vec(-1, 0));
  assert.equal(hitSegment(vec(0, 0), vec(0, 1), s), Infinity);
  assert.equal(hitSegment(vec(0, 0), vec(-1, 0), s), Infinity);
  assert.equal(hitSegment(vec(0, 3), vec(1, 0), s), Infinity);
});

test('ray starting on a segment does not hit it again', () => {
  const s = segment(vec(5, -1), vec(5, 1), vec(-1, 0));
  assert.equal(hitSegment(vec(5, 0), vec(1, 0), s), Infinity);
});

test('ray meets the near side of a full circle from outside and the far side from inside', () => {
  const full = arc(vec(0, 0), 2, 0, Math.PI * 2);
  close(hitArc(vec(-5, 0), vec(1, 0), full), 3);
  close(hitArc(vec(0, 0), vec(1, 0), full), 2);
});

test('arc only counts hits inside its angular span', () => {
  const rightHalf = arc(vec(0, 0), 2, -Math.PI / 2, Math.PI);
  close(hitArc(vec(-5, 0), vec(1, 0), rightHalf), 7);
  const leftHalf = arc(vec(0, 0), 2, Math.PI / 2, Math.PI);
  close(hitArc(vec(-5, 0), vec(1, 0), leftHalf), 3);
  assert.equal(hitArc(vec(5, 0), vec(1, 0), leftHalf), Infinity);
});

test('arc normal points away from the centre on convex faces and toward it on concave ones', () => {
  const p = vec(2, 0);
  assert.deepEqual(normalAt(arc(vec(0, 0), 2, 0, 1, 1), p), { x: 1, y: 0 });
  assert.deepEqual(normalAt(arc(vec(0, 0), 2, 0, 1, -1), p), { x: -1, y: -0 });
});

test('polygon normals point outward for either vertex order', () => {
  const ccw = [vec(0, 0), vec(1, 0), vec(1, 1), vec(0, 1)];
  const cw = [...ccw].reverse();
  for (const pts of [ccw, cw]) {
    for (const s of polygon(pts)) {
      const mid = vec((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2);
      const toCentre = vec(0.5 - mid.x, 0.5 - mid.y);
      assert.ok(s.normal.x * toCentre.x + s.normal.y * toCentre.y < 0);
    }
  }
});

test('rotate and wrapAngle behave on simple cases', () => {
  const r = rotate(vec(1, 0), Math.PI / 2);
  close(r.x, 0);
  close(r.y, 1);
  close(wrapAngle(-Math.PI / 2), 1.5 * Math.PI);
  close(wrapAngle(5 * Math.PI), Math.PI);
});
