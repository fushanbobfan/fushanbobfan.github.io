import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gamma, boost, unboost, relativeVelocity, addVelocities, interval, separation,
  properTime, properDistance, simultaneousFrame, colocatedFrame, order, orderCanFlip,
  betaRangeWhereLater, rapidity, betaFromRapidity, clampBeta, MAX_BETA,
} from '../src/lorentz.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('gamma is 1 at rest and 5/3 at 0.8c, and refuses light speed', () => {
  close(gamma(0), 1);
  close(gamma(0.8), 5 / 3);
  close(gamma(-0.6), 1.25);
  assert.throws(() => gamma(1), RangeError);
  assert.throws(() => gamma(NaN), RangeError);
});

test('a boost and its inverse return the original event', () => {
  const e = { t: 2.3, x: -1.7 };
  for (const beta of [-0.9, -0.3, 0, 0.5, 0.95]) {
    const back = unboost(boost(e, beta), beta);
    close(back.t, e.t);
    close(back.x, e.x);
  }
});

test('an observer at 0.6c sees the lab origin moving away at -0.6c', () => {
  const later = boost({ t: 1, x: 0 }, 0.6);
  close(later.x / later.t, -0.6);
  close(later.t, 1.25, 1e-12); // moving clock seen to run slow: 1 s of lab time at x = 0 is 1.25 s here
});

test('the interval is the same in every frame', () => {
  const a = { t: 0.4, x: 1.1 };
  const b = { t: 3.2, x: -0.5 };
  for (const beta of [-0.8, 0.2, 0.7]) {
    close(interval(boost(a, beta), boost(b, beta)), interval(a, b));
  }
});

test('separations are classified by the sign of the interval', () => {
  const o = { t: 0, x: 0 };
  assert.equal(separation(o, { t: 2, x: 1 }), 'timelike');
  assert.equal(separation(o, { t: 1, x: 2 }), 'spacelike');
  assert.equal(separation(o, { t: 3, x: -3 }), 'lightlike');
  assert.equal(separation(o, { t: 3, x: 3 + 1e-12 }), 'lightlike');
});

test('proper time and proper distance', () => {
  const o = { t: 0, x: 0 };
  close(properTime(o, { t: 5, x: 3 }), 4);
  assert.equal(properTime(o, { t: 3, x: 5 }), null);
  close(properDistance(o, { t: 3, x: 5 }), 4);
  assert.equal(properDistance(o, { t: 5, x: 3 }), null);
});

test('the simultaneous frame makes spacelike events happen together', () => {
  const a = { t: 1, x: -2 };
  const b = { t: 2, x: 2 };
  const beta = simultaneousFrame(a, b);
  close(beta, 0.25);
  close(boost(a, beta).t, boost(b, beta).t);
  assert.equal(order(a, b, beta), 0);
  assert.equal(simultaneousFrame({ t: 0, x: 0 }, { t: 2, x: 1 }), null);
});

test('the colocated frame puts timelike events at one place', () => {
  const a = { t: 0, x: 1 };
  const b = { t: 4, x: 3 };
  const beta = colocatedFrame(a, b);
  close(beta, 0.5);
  close(boost(a, beta).x, boost(b, beta).x);
  assert.equal(colocatedFrame({ t: 0, x: 0 }, { t: 1, x: 2 }), null);
});

test('only spacelike pairs can swap order', () => {
  const a = { t: 0, x: 0 };
  const b = { t: 1, x: 3 };
  assert.ok(orderCanFlip(a, b));
  assert.equal(order(a, b, 0), 1);
  assert.equal(order(a, b, 0.6), -1);
  const c = { t: 3, x: 1 };
  assert.ok(!orderCanFlip(a, c));
  for (const beta of [-0.99, 0, 0.99]) assert.equal(order(a, c, beta), 1);
});

test('the range of observers who see b after a ends where the order flips', () => {
  const a = { t: 0, x: 0 };
  const right = betaRangeWhereLater(a, { t: 1, x: 3 });
  assert.deepEqual(right, { from: -1, to: 1 / 3 });
  const left = betaRangeWhereLater(a, { t: 1, x: -3 });
  assert.deepEqual(left, { from: -1 / 3, to: 1 });
  assert.deepEqual(betaRangeWhereLater(a, { t: 2, x: 1 }), { from: -1, to: 1 });
  assert.equal(betaRangeWhereLater(a, { t: -2, x: 1 }), null);
  for (const beta of [-0.9, 0, 0.3]) assert.equal(order(a, { t: 1, x: 3 }, beta), 1);
  assert.equal(order(a, { t: 1, x: 3 }, 0.4), -1);
});

test('velocity addition never reaches light speed', () => {
  close(addVelocities(0.5, 0.5), 0.8);
  close(addVelocities(0.9, 0.9), 1.8 / 1.81);
  close(addVelocities(1, 0.7), 1);
  close(relativeVelocity(addVelocities(0.3, 0.6), 0.6), 0.3);
});

test('rapidities add where velocities do not', () => {
  close(betaFromRapidity(rapidity(0.5) + rapidity(0.5)), addVelocities(0.5, 0.5));
});

test('clampBeta keeps frames below light speed', () => {
  assert.equal(clampBeta(2), MAX_BETA);
  assert.equal(clampBeta(-1), -MAX_BETA);
  assert.equal(clampBeta(0.3), 0.3);
});
