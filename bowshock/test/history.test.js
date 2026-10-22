import { test } from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../src/history.js';

test('the history keeps just over its span and drops older samples', () => {
  const h = new History(1);
  for (let i = 0; i <= 300; i++) h.push(i / 100, i, 0, 1, 0);
  assert.ok(h.at(0).t < 2 && h.at(0).t >= 1.99 - 0.011);
  assert.ok(h.at(1).t >= 2 - 1);
  assert.equal(h.at(h.length - 1).t, 3);
});

test('the first kept sample always starts a piece', () => {
  const h = new History(0.5);
  for (let i = 0; i < 200; i++) h.push(i / 100, i, 0, 1, 0);
  assert.equal(h.at(0).brk, true);
  assert.equal(h.at(5).brk, false);
});

test('breaks survive pushing and compacting', () => {
  const h = new History(1000);
  for (let i = 0; i < 5000; i++) h.push(i, i, 0, 1, 0, i === 4990);
  h.span = 50;
  h.push(5000, 0, 0, 1, 0);
  h.compact();
  const i = [...Array(h.length).keys()].find((k) => h.at(k).t === 4990);
  assert.equal(h.at(i).brk, true);
  assert.equal(h.at(i + 1).brk, false);
  assert.equal(h.at(0).brk, true);
});

test('lerp interpolates every field between neighbours', () => {
  const h = new History(10);
  h.push(0, 0, 0, 1, 2, false, 0, 0);
  h.push(1, 10, 20, 3, 4, false, 4, -8);
  const p = h.lerp(1, 0.25);
  assert.deepEqual(p, { t: 0.25, x: 2.5, y: 5, vx: 1.5, vy: 2.5, ax: 1, ay: -2 });
});
