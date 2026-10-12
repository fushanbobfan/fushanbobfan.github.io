import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTrail, deposit, sample, diffuseDecay, totalTrail, maxTrail, wrapIndex, clearTrail, stamp,
} from '../src/trail.js';

const close = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('deposit and sample agree on the cell under a point', () => {
  const t = createTrail(8, 6);
  deposit(t, 3.7, 2.2, 5, false);
  assert.equal(sample(t, 3.1, 2.9, false), 5);
  assert.equal(sample(t, 4, 2, false), 0);
});

test('a closed world ignores points off the grid', () => {
  const t = createTrail(4, 4);
  deposit(t, -1, 2, 5, false);
  deposit(t, 2, 4, 5, false);
  assert.equal(totalTrail(t), 0);
  assert.equal(sample(t, -0.5, 1, false), 0);
});

test('a wrapping world folds points back onto the grid', () => {
  const t = createTrail(4, 4);
  deposit(t, -1, 5, 2, true);
  assert.equal(t.data[wrapIndex(t, 3, 1)], 2);
  assert.equal(sample(t, 7, -3, true), 2);
});

test('wrapped diffusion without decay conserves the total', () => {
  const t = createTrail(10, 7);
  deposit(t, 0, 0, 9, true);
  deposit(t, 5, 3, 4, true);
  for (let i = 0; i < 20; i++) diffuseDecay(t, 1, 0, true);
  close(totalTrail(t), 13);
});

test('one full-spread pass turns a point into an even 3x3 block', () => {
  const t = createTrail(5, 5);
  deposit(t, 2, 2, 9, true);
  diffuseDecay(t, 1, 0, true);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const inside = Math.abs(x - 2) <= 1 && Math.abs(y - 2) <= 1;
      close(sample(t, x, y, true), inside ? 1 : 0);
    }
  }
});

test('spread blends between keeping the cell and the neighbourhood mean', () => {
  const t = createTrail(5, 5);
  deposit(t, 2, 2, 9, true);
  diffuseDecay(t, 0.5, 0, true);
  close(sample(t, 2, 2, true), 5);
  close(sample(t, 1, 2, true), 0.5);
});

test('decay removes the stated fraction each step', () => {
  const t = createTrail(6, 6);
  deposit(t, 1, 1, 10, true);
  diffuseDecay(t, 0, 0.1, true);
  close(totalTrail(t), 9);
  diffuseDecay(t, 1, 0.1, true);
  close(totalTrail(t), 8.1);
});

test('the edge of a closed world averages only real neighbours', () => {
  const t = createTrail(4, 4);
  deposit(t, 0, 0, 4, false);
  diffuseDecay(t, 1, 0, false);
  close(sample(t, 0, 0, false), 1);
  close(maxTrail(t), 1);
});

test('clearing empties the layer', () => {
  const t = createTrail(3, 3);
  deposit(t, 1, 1, 3, true);
  clearTrail(t);
  assert.equal(totalTrail(t), 0);
});

test('a stamp paints a disc and clips at a closed edge', () => {
  const t = createTrail(20, 20);
  stamp(t, 10, 10, 2, 1, false);
  close(totalTrail(t), 13);
  clearTrail(t);
  stamp(t, 0, 10, 2, 1, false);
  close(totalTrail(t), 9);
});
