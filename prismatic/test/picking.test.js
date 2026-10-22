import test from 'node:test';
import assert from 'node:assert/strict';
import { vec } from '../src/geometry.js';
import { makeElement, piecesOf } from '../src/elements.js';
import {
  elementAt, insideOutline, distanceToPiece, handleOf, onHandle,
} from '../src/picking.js';

test('points inside a glass shape pick it, points well outside do not', () => {
  const prism = makeElement('prism', 200, 200);
  const bench = [prism];
  assert.equal(elementAt(bench, vec(200, 200)), prism);
  assert.equal(elementAt(bench, vec(200, 60)), null);
  assert.equal(elementAt(bench, vec(400, 200)), null);
});

test('insideOutline agrees with a rotated block', () => {
  const block = makeElement('block', 0, 0, Math.PI / 4, { width: 100, height: 20 });
  const pieces = piecesOf(block);
  assert.ok(insideOutline(vec(30, 30), pieces));
  assert.ok(!insideOutline(vec(30, -30), pieces));
});

test('thin elements are picked within a few pixels of the line', () => {
  const mirror = makeElement('mirror', 0, 0);
  assert.equal(elementAt([mirror], vec(5, 40)), mirror);
  assert.equal(elementAt([mirror], vec(20, 40)), null);
  const curved = makeElement('curvedMirror', 0, 0);
  assert.equal(elementAt([curved], vec(0, 0)), curved);
  assert.ok(distanceToPiece(vec(-50, 0), piecesOf(curved)[0]) > 40);
});

test('a source beats the glass it sits on, and later elements beat earlier ones', () => {
  const block = makeElement('block', 0, 0);
  const laser = makeElement('laser', 10, 0);
  assert.equal(elementAt([laser, block], vec(12, 0)), laser);
  const top = makeElement('block', 20, 0);
  assert.equal(elementAt([block, top], vec(10, 0)), top);
});

test('the rotation handle sits outside the element along its angle', () => {
  for (const kind of ['prism', 'block', 'convexLens', 'ball', 'mirror', 'laser']) {
    const el = makeElement(kind, 100, 100, 0.8);
    const h = handleOf(el);
    const dx = h.x - 100;
    const dy = h.y - 100;
    assert.ok(Math.abs(Math.atan2(dy, dx) - 0.8) < 1e-9, kind);
    assert.ok(onHandle(el, vec(h.x + 3, h.y - 3)));
    assert.ok(!onHandle(el, vec(100, 100)));
    if (kind !== 'laser') assert.ok(!insideOutline(h, piecesOf(el)), kind);
  }
});
