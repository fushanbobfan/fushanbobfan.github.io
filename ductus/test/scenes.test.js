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

test('weighted scenes keep their weights and the slider runs on a log scale', async () => {
  const { weightFromSlider, sliderFromWeight, withWeight, MIN_WEIGHT, MAX_WEIGHT } = await import('../src/scenes.js');
  const pts = scenePoints(sceneById('circle'));
  assert.equal(pts[1].w, Math.SQRT1_2);
  assert.equal(pts[0].w, undefined);
  assert.equal(weightFromSlider(1), 2);
  assert.equal(weightFromSlider(sliderFromWeight(0.3)), 0.3);
  assert.equal(sliderFromWeight(undefined), 0);
  assert.equal(withWeight(pts, 0, 99)[0].w, MAX_WEIGHT);
  assert.equal(withWeight(pts, 0, 0)[0].w, MIN_WEIGHT);
  assert.equal(clampToBoard({ x: 10, y: 10, w: 3 }).w, 3);
});

test('snapping to a circular arc gives equal legs and a curve of constant curvature', async () => {
  const { asCircularArc } = await import('../src/scenes.js');
  const { circleWeight } = await import('../src/bezier.js');
  const start = [{ x: 100, y: 500 }, { x: 250, y: 120 }, { x: 560, y: 330 }];
  const arc = asCircularArc(start, circleWeight);
  const leg = (p) => Math.hypot(p.x - arc[1].x, p.y - arc[1].y);
  assert.ok(Math.abs(leg(arc[0]) - leg(arc[2])) < 1e-9);
  const k0 = curvature(arc, 0);
  for (const t of [0.2, 0.5, 0.9]) assert.ok(Math.abs(curvature(arc, t) - k0) < 1e-9 * Math.abs(k0) * 1e3);
  for (const p of arc) assert.ok(p.x >= 0 && p.x <= BOARD && p.y >= 0 && p.y <= BOARD);
  assert.deepEqual(asCircularArc(scenePoints(sceneById('cubic')), circleWeight).length, 4);
});

test('the quarter-circle scene is already a circle', () => {
  const pts = scenePoints(sceneById('circle'));
  const k0 = curvature(pts, 0);
  assert.ok(Math.abs(Math.abs(k0) - 1 / 360) < 1e-9);
  assert.ok(Math.abs(curvature(pts, 0.5) - k0) < 1e-12);
});
