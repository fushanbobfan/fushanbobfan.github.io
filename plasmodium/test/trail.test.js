import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTrail, deposit, sample, diffuseDecay, totalTrail, maxTrail, wrapIndex, clearTrail, stamp, setWall, clearWalls, isWall,
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

test('walls take no trail and nothing spreads into them', () => {
  const t = createTrail(9, 3);
  for (let y = 0; y < 3; y++) setWall(t, y * 9 + 4, true);
  assert.equal(t.wallCount, 3);
  deposit(t, 4, 1, 10, false);
  assert.equal(totalTrail(t), 0);
  deposit(t, 2, 1, 9, false);
  for (let k = 0; k < 30; k++) diffuseDecay(t, 1, 0, false);
  for (let y = 0; y < 3; y++) {
    for (let x = 4; x < 9; x++) assert.equal(sample(t, x, y, false), 0, `${x},${y}`);
  }
  assert.ok(isWall(t, 4, 2, false));
  assert.ok(!isWall(t, 3, 2, false));
});

test('a wrapped world with walls keeps close to the same total on the open side', () => {
  const t = createTrail(8, 8);
  setWall(t, 0, true);
  deposit(t, 4, 4, 10, true);
  for (let k = 0; k < 10; k++) diffuseDecay(t, 1, 0, true);
  close(totalTrail(t), 10, 0.5);
  assert.equal(t.data[0], 0);
});

test('setting a wall wipes its trail and clearing walls reopens the cells', () => {
  const t = createTrail(4, 4);
  deposit(t, 1, 1, 5, false);
  setWall(t, 5, true);
  setWall(t, 5, true);
  assert.equal(t.wallCount, 1);
  assert.equal(totalTrail(t), 0);
  clearWalls(t);
  assert.equal(t.wallCount, 0);
  deposit(t, 1, 1, 5, false);
  assert.equal(totalTrail(t), 5);
});
