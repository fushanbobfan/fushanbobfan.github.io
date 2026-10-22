import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAPERS, mmPerPixel, cumulativeLengths, penAt, plotSeconds, formatDuration } from '../src/plot.js';

const square = new Float64Array([0, 0, 10, 0, 10, 10, 0, 10]);
const tour = new Int32Array([0, 1, 2, 3]);

test('a landscape picture fits the long side of the paper, a portrait one the short side', () => {
  // 480 x 360 on A4 landscape with 15 mm margins: 267 x 180 mm available.
  assert.ok(Math.abs(mmPerPixel(480, 360, 'a4') - 0.5) < 1e-12);
  // 360 x 480 turns the paper upright: 180 x 267 mm.
  assert.ok(Math.abs(mmPerPixel(360, 480, 'a4') - 0.5) < 1e-12);
  assert.ok(mmPerPixel(480, 360, 'a3') > mmPerPixel(480, 360, 'a4'));
  assert.throws(() => mmPerPixel(10, 10, 'a0'));
  assert.ok(Object.keys(PAPERS).length >= 3);
});

test('cumulative lengths close the loop', () => {
  assert.deepEqual([...cumulativeLengths(square, tour)], [0, 10, 20, 30, 40]);
});

test('the pen moves along the tour and counts the dots it has passed', () => {
  const cum = cumulativeLengths(square, tour);
  assert.deepEqual(penAt(square, tour, cum, 0), { passed: 1, x: 0, y: 0 });
  assert.deepEqual(penAt(square, tour, cum, 15), { passed: 2, x: 10, y: 5 });
  assert.deepEqual(penAt(square, tour, cum, 35), { passed: 4, x: 0, y: 5 });
  assert.deepEqual(penAt(square, tour, cum, 99), { passed: 4, x: 0, y: 0 });
  assert.deepEqual(penAt(square, tour, cum, -3), { passed: 1, x: 0, y: 0 });
});

test('a pen on an empty tour stays put', () => {
  assert.deepEqual(penAt(square, new Int32Array(0), new Float64Array(1), 5), { passed: 0, x: 0, y: 0 });
});

test('plot time: the line is length over speed, dots add a tap each', () => {
  assert.equal(plotSeconds({ mode: 'line', length: 1000, dots: 50, mmPerPx: 0.5, drawSpeed: 25 }), 20);
  assert.equal(plotSeconds({ mode: 'dots', length: 1200, dots: 40, mmPerPx: 0.5, travelSpeed: 100, dotTime: 0.25 }), 16);
});

test('durations read naturally', () => {
  assert.equal(formatDuration(42.4), '42 s');
  assert.equal(formatDuration(125), '2 min 05 s');
  assert.equal(formatDuration(3 * 3600 + 7 * 60 + 9), '3 h 07 min');
});
