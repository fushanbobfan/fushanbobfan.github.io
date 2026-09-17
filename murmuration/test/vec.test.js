import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vec, add, sub, scale, length, distance, normalize, setMagnitude, limit, heading, fromAngle,
} from '../src/vec.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('add and sub combine components', () => {
  assert.deepEqual(add(vec(1, 2), vec(3, 4)), { x: 4, y: 6 });
  assert.deepEqual(sub(vec(1, 2), vec(3, 4)), { x: -2, y: -2 });
});

test('scale multiplies both components', () => {
  assert.deepEqual(scale(vec(1, -2), 3), { x: 3, y: -6 });
});

test('length and distance use the Euclidean norm', () => {
  assert.equal(length(vec(3, 4)), 5);
  assert.equal(distance(vec(1, 1), vec(4, 5)), 5);
});

test('normalize yields a unit vector and leaves zero alone', () => {
  const n = normalize(vec(3, 4));
  assert.ok(close(n.x, 0.6) && close(n.y, 0.8));
  assert.deepEqual(normalize(vec(0, 0)), { x: 0, y: 0 });
});

test('setMagnitude rescales to the requested length', () => {
  const v = setMagnitude(vec(0, 2), 5);
  assert.ok(close(v.x, 0) && close(v.y, 5));
  assert.deepEqual(setMagnitude(vec(0, 0), 5), { x: 0, y: 0 });
});

test('limit clamps long vectors and copies short ones', () => {
  const clamped = limit(vec(6, 8), 5);
  assert.ok(close(length(clamped), 5));
  assert.ok(close(clamped.x / clamped.y, 0.75));
  const short = vec(1, 1);
  const copy = limit(short, 5);
  assert.deepEqual(copy, short);
  assert.notEqual(copy, short);
});

test('heading and fromAngle round-trip', () => {
  const v = fromAngle(Math.PI / 3, 2);
  assert.ok(close(length(v), 2));
  assert.ok(close(heading(v), Math.PI / 3));
});

test('helpers never mutate their inputs', () => {
  const a = vec(1, 2);
  const b = vec(3, 4);
  add(a, b); sub(a, b); scale(a, 2); normalize(a); limit(a, 0.5); setMagnitude(a, 9);
  assert.deepEqual(a, { x: 1, y: 2 });
  assert.deepEqual(b, { x: 3, y: 4 });
});
