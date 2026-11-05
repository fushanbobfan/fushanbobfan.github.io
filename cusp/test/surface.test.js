import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSICAL, angleGap, torque } from '../src/machine.js';
import { traceFoldSet } from '../src/foldset.js';
import {
  DEFAULT_TURN, buildRibs, clampPitch, liftedCrease, ribOrder, rotate, surfaceBox, toScene,
} from '../src/surface.js';

const m = CLASSICAL;
const chains = traceFoldSet(m);
const box = surfaceBox(chains);
const ribs = buildRibs(m, box);

test('the box holds the whole set with room to spare', () => {
  for (const p of chains[0].points) {
    assert.ok(p.x > box.x0 && p.x < box.x1);
    assert.ok(Math.abs(p.y) < box.yHalf);
  }
});

test('the scene fits in a unit box', () => {
  for (const [x, y, t] of [[box.x0, box.yHalf, Math.PI - 0.01], [box.x1, -box.yHalf, -Math.PI]]) {
    const p = toScene(box, x, y, t);
    assert.ok(Math.abs(Math.abs(p.x) - 1) < 1e-12);
    assert.ok(Math.abs(p.y) <= 0.7 + 1e-12);
    assert.ok(Math.abs(p.z) <= 0.62 + 1e-12);
  }
});

test('turning keeps every length', () => {
  const p = { x: 0.4, y: -0.7, z: 0.3 };
  const q = { x: -0.9, y: 0.2, z: 0.55 };
  const gap = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  for (const turn of [DEFAULT_TURN, { yaw: 2.1, pitch: 1.2 }, { yaw: -1, pitch: -0.2 }]) {
    const a = rotate(p, turn);
    const b = rotate(q, turn);
    assert.ok(Math.abs(Math.hypot(a.across - b.across, a.up - b.up, a.depth - b.depth) - gap) < 1e-12);
  }
});

test('with no turn the floor lies flat and depth is y', () => {
  const r = rotate({ x: 0.5, y: 0.25, z: 0.1 }, { yaw: 0, pitch: 0 });
  assert.equal(r.across, 0.5);
  assert.equal(r.up, 0.1);
  assert.equal(r.depth, 0.25);
});

test('pitch stops short of turning the surface over', () => {
  assert.equal(clampPitch(9), 1.5);
  assert.equal(clampPitch(-9), -0.2);
  assert.equal(clampPitch(0.5), 0.5);
});

test('every rib segment lies on the zero of the torque', () => {
  for (const rib of ribs) {
    for (const seg of rib.segments) {
      assert.ok(Math.abs(torque(m, rib.x, seg.sa, seg.ta)) < 4e-3, `${rib.x} ${seg.sa} ${seg.ta}`);
    }
  }
});

test('no rib segment runs across the seam', () => {
  const size = (2 * Math.PI) / 110;
  for (const rib of ribs) {
    for (const seg of rib.segments) {
      assert.ok(Math.abs(angleGap(seg.ta, seg.tb)) <= size * 1.01);
    }
  }
});

test('ribs far from the set are a single stable sheet and a single unstable one', () => {
  const rib = ribs[ribs.length - 1];
  const crossing = (stable) => rib.segments.filter((seg) => seg.stable === stable
    && (seg.sa > 0.123) !== (seg.sb > 0.123));
  assert.equal(crossing(true).length, 1);
  assert.equal(crossing(false).length, 1);
});

test('ribs inside the diamond have two stable sheets at the middle', () => {
  const rib = ribs.reduce((best, r) => (Math.abs(r.x + 1.95) < Math.abs(best.x + 1.95) ? r : best));
  const stableAtMiddle = rib.segments.filter((seg) => seg.stable && (seg.sa > 0.03) !== (seg.sb > 0.03));
  assert.equal(stableAtMiddle.length, 2);
});

test('ribs are painted back to front at any turn', () => {
  for (const turn of [DEFAULT_TURN, { yaw: 2.4, pitch: 0.2 }, { yaw: 0.9, pitch: 1 }]) {
    const depths = ribOrder(ribs, box, turn).map((rib) => rotate(toScene(box, rib.x, 0, 0), turn).depth);
    for (let i = 1; i < depths.length; i += 1) assert.ok(depths[i - 1] >= depths[i]);
  }
});

test('the crease is the set, lifted to its own pin angle', () => {
  const [crease] = liftedCrease(chains, box);
  assert.equal(crease.points.length, chains[0].points.length);
  assert.ok(crease.closed);
  const i = 200;
  const expected = toScene(box, chains[0].points[i].x, chains[0].points[i].y, chains[0].points[i].theta);
  assert.deepEqual({ x: crease.points[i].x, y: crease.points[i].y, z: crease.points[i].z }, expected);
});
