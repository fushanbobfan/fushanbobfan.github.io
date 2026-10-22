import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attractingCycle, nucleus } from '../src/cycle.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);

test('inside the main cardioid the cycle is the attracting fixed point', () => {
  const c = -0.5;
  const cyc = attractingCycle(c, 0);
  assert.equal(cyc.period, 1);
  const z = (1 - Math.sqrt(1 - 4 * c)) / 2;
  close(cyc.points[0], z, 1e-14, 'fixed point');
  close(cyc.multiplier.re, 2 * z, 1e-14, 'multiplier');
  assert.ok(cyc.multiplier.abs < 1);
});

test('superattracting centres have multiplier zero', () => {
  const one = attractingCycle(-1, 0);
  assert.equal(one.period, 2);
  assert.ok(one.multiplier.abs < 1e-12);
  const pts = Array.from(one.points).map((v) => Math.round(v * 1e9) / 1e9 + 0);
  assert.deepEqual(pts.sort(), [-1, 0, 0, 0].sort());
});

test('known periods: rabbit, airplane, 1/4 and 1/5 bulbs, the period-4 real bulb', () => {
  assert.equal(attractingCycle(-0.122561, 0.744862).period, 3);
  assert.equal(attractingCycle(-1.754878, 0).period, 3);
  assert.equal(attractingCycle(0.282, 0.53).period, 4);
  assert.equal(attractingCycle(0.3795, 0.3349).period, 5);
  assert.equal(attractingCycle(-1.3, 0).period, 4);
});

test('the multiplier modulus grows towards one at a component boundary', () => {
  // along the real axis inside the period-2 disk, centre -1, boundary -0.75
  let prev = -1;
  for (const x of [-1, -0.95, -0.9, -0.85, -0.8, -0.77]) {
    const m = attractingCycle(x, 0, 200000).multiplier.abs;
    assert.ok(m > prev && m < 1, `|lambda| = ${m} at ${x}`);
    prev = m;
  }
  // the period-2 multiplier is 4(c + 1), so it is exact here
  close(attractingCycle(-0.9, 0).multiplier.re, 0.4, 1e-12, 'lambda at -0.9');
});

test('escaping and preperiodic parameters have no attracting cycle', () => {
  assert.equal(attractingCycle(1, 0), null);
  assert.equal(attractingCycle(0, 1), null); // c = i: 0 lands on a repelling cycle
  assert.equal(attractingCycle(-2, 0), null);
});

test('Newton finds the nuclei of known components', () => {
  const rabbit = nucleus(-0.1, 0.7, 3);
  close(rabbit.re, -0.122561166876654, 1e-13, 'rabbit re');
  close(rabbit.im, 0.744861766619744, 1e-13, 'rabbit im');
  const plane = nucleus(-1.75, 0, 3);
  close(plane.re, -1.754877666246693, 1e-13, 'airplane');
  close(plane.im, 0, 1e-13, 'airplane im');
  const two = nucleus(-0.9, 0.1, 2);
  close(two.re, -1, 1e-13, 'period 2');
  const one = nucleus(0.1, 0.1, 1);
  close(one.re, 0, 1e-13, 'period 1');
});

test('a nucleus is superattracting: its critical orbit returns to 0', () => {
  const n = nucleus(0.38, 0.33, 5);
  const cyc = attractingCycle(n.re, n.im);
  assert.equal(cyc.period, 5);
  assert.ok(cyc.multiplier.abs < 1e-9);
});
