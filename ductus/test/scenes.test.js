import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENES, BOARD, MIN_POINTS, MAX_POINTS, sceneById, scenePoints, withExtraPoint, withoutPoint, clampToBoard,
} from '../src/scenes.js';
import { curvature } from '../src/bezier.js';

test('every scene has a unique id, a note and points on the board', () => {
  const ids = new Set();
  for (const s of SCENES) {
    assert.ok(!ids.has(s.id), s.id);
    ids.add(s.id);
    assert.ok(s.note.length > 40);
    assert.ok(s.points.length >= MIN_POINTS && s.points.length <= MAX_POINTS);
    for (const [x, y] of s.points) assert.ok(x >= 0 && x <= BOARD && y >= 0 && y <= BOARD);
  }
  assert.equal(sceneById('nope').id, SCENES[0].id);
});

test('the S bend really inflects and the arch does not', () => {
  const sign = (pts) => [0.05, 0.95].map((t) => Math.sign(curvature(pts, t)));
  const s = sign(scenePoints(sceneById('inflection')));
  assert.notEqual(s[0], s[1]);
  const a = sign(scenePoints(sceneById('cubic')));
  assert.equal(a[0], a[1]);
});

test('the near-cusp curves far more sharply than the loop', () => {
  const peak = (pts) => {
    let m = 0;
    for (let i = 0; i <= 400; i++) m = Math.max(m, Math.abs(curvature(pts, i / 400)));
    return m;
  };
  assert.ok(peak(scenePoints(sceneById('cusp'))) > 3 * peak(scenePoints(sceneById('loop'))));
});

test('adding keeps the end points and stops at the maximum', () => {
  let pts = scenePoints(sceneById('quadratic'));
  const end = pts[pts.length - 1];
  pts = withExtraPoint(pts);
  assert.equal(pts.length, 4);
  assert.deepEqual(pts[pts.length - 1], end);
  while (pts.length < MAX_POINTS) pts = withExtraPoint(pts);
  assert.equal(withExtraPoint(pts).length, MAX_POINTS);
});

test('removing stops at two points and clamping keeps points on the board', () => {
  const two = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  assert.equal(withoutPoint(two, 0).length, 2);
  assert.equal(withoutPoint(scenePoints(sceneById('cubic')), 1).length, 3);
  assert.deepEqual(clampToBoard({ x: -5, y: 900 }), { x: 8, y: BOARD - 8 });
});
