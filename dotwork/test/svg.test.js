import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dotsSvg, tourSvg } from '../src/svg.js';

const pts = new Float64Array([1, 2, 3.456, 4.001, 5, 6]);

test('dots become one circle each, scaled, skipping empty ones', () => {
  const svg = dotsSvg(pts, new Float64Array([0.5, 1, 0]), 3, 10, 8, { scale: 2, ink: '#123', paper: null });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="20" height="16" viewBox="0 0 20 16">/);
  assert.equal((svg.match(/<circle /g) || []).length, 2);
  assert.match(svg, /<circle cx="2" cy="4" r="1"\/>/);
  assert.match(svg, /<circle cx="6.91" cy="8" r="2"\/>/);
  assert.match(svg, /<g fill="#123">/);
  assert.doesNotMatch(svg, /<rect/);
});

test('a paper colour adds a background', () => {
  assert.match(dotsSvg(pts, new Float64Array([1, 1, 1]), 3, 10, 8), /<rect width="100%" height="100%" fill="#fff"\/>/);
});

test('the tour is one closed path in tour order', () => {
  const svg = tourSvg(pts, new Int32Array([2, 0, 1]), 10, 8, { stroke: 0.75 });
  assert.equal((svg.match(/<path /g) || []).length, 1);
  assert.match(svg, /d="M 5 6 L 1 2 3.46 4 Z"/);
  assert.match(svg, /stroke-width="0.75"/);
});

test('an empty tour still makes a valid page', () => {
  assert.doesNotMatch(tourSvg(pts, new Int32Array(0), 10, 8), /<path/);
});

test('coloured dots are grouped by their exact colour', () => {
  const colours = new Uint8ClampedArray([255, 0, 0, 0, 128, 255, 255, 0, 0]);
  const svg = dotsSvg(pts, new Float64Array([1, 1, 1]), 3, 10, 8, { colours });
  assert.equal((svg.match(/<g fill=/g) || []).length, 2);
  assert.match(svg, /<g fill="#ff0000"><circle cx="1" cy="2" r="1"\/><circle cx="5" cy="6" r="1"\/><\/g>/);
  assert.match(svg, /<g fill="#0080ff">/);
});
