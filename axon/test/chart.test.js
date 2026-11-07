import test from 'node:test';
import assert from 'node:assert/strict';
import { dataRange, niceTicks, plotBox } from '../src/chart.js';

test('ticks are round and stay inside the range', () => {
  assert.deepEqual(niceTicks(0, 50, 10), [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  assert.deepEqual(niceTicks(-80, 40, 4), [-80, -60, -40, -20, 0, 20, 40]);
  for (const tick of niceTicks(-3.7, 11.2, 5)) assert.ok(tick >= -3.7 && tick <= 11.2);
});

test('ticks survive small spans without floating-point dust', () => {
  assert.deepEqual(niceTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
});

test('a flat range still gives something to plot', () => {
  assert.deepEqual(niceTicks(3, 3), [3]);
  const [low, high] = dataRange([[5, 5, 5]], { minSpan: 2 });
  assert.ok(low < 4.1 && high > 5.9);
});

test('the range covers every array and has margins', () => {
  const [low, high] = dataRange([[0, 1], new Float64Array([-1, 2])], { pad: 0.1 });
  assert.ok(low < -1 && high > 2);
  assert.deepEqual(dataRange([[]], { minSpan: 4 }), [0, 4]);
});

test('a compact chart gives back the room of its x axis', () => {
  assert.ok(plotBox(300, 100, true).bottom > plotBox(300, 100).bottom);
});
