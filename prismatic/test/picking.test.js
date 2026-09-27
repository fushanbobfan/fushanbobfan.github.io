import test from 'node:test';
import assert from 'node:assert/strict';
import { vec } from '../src/geometry.js';
import { makeElement, piecesOf } from '../src/elements.js';
import { elementAt, insideOutline, distanceToPiece } from '../src/picking.js';
import { wavelengthToRGB, wavelengthToCss } from '../src/spectrum.js';

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

test('spectrum colours run from violet through green to red and fade outside the visible range', () => {
  const [r1, , b1] = wavelengthToRGB(400);
  assert.ok(b1 > r1);
  const [, g2] = wavelengthToRGB(530);
  assert.ok(g2 === 1);
  const [r3, g3, b3] = wavelengthToRGB(680);
  assert.ok(r3 === 1 && g3 === 0 && b3 === 0);
  assert.deepEqual(wavelengthToRGB(300), [0, 0, 0]);
  assert.deepEqual(wavelengthToRGB(900), [0, 0, 0]);
  assert.equal(wavelengthToCss(680, 0.5), 'rgba(255, 0, 0, 0.5)');
});
