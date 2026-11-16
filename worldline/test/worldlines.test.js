import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCausalPath, properTimeAlong, clockTicks, positionAt, uniform, lightMeets,
} from '../src/worldlines.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('a clock at rest shows lab time; a moving one shows less', () => {
  close(properTimeAlong([{ t: 0, x: 0 }, { t: 5, x: 0 }]), 5);
  close(properTimeAlong(uniform(0.6, 0, 0, 5)), 4);
});

test('the travelling twin comes home younger', () => {
  const home = [{ t: -4, x: 0 }, { t: 4, x: 0 }];
  const away = [{ t: -4, x: 0 }, { t: 0, x: 2.4 }, { t: 4, x: 0 }];
  close(properTimeAlong(home), 8);
  close(properTimeAlong(away), 6.4);
});

test('paths that outrun light or go backwards are refused', () => {
  assert.ok(!isCausalPath([{ t: 0, x: 0 }, { t: 1, x: 2 }]));
  assert.ok(!isCausalPath([{ t: 1, x: 0 }, { t: 0, x: 0 }]));
  assert.ok(isCausalPath([{ t: 0, x: 0 }, { t: 1, x: 1 }]));
  assert.throws(() => properTimeAlong([{ t: 0, x: 0 }, { t: 1, x: 2 }]), RangeError);
});

test('clock ticks are spaced by proper time, so they spread out on fast pieces', () => {
  const ticks = clockTicks(uniform(0.6, 0, 0, 5), 1);
  assert.deepEqual(ticks.map((k) => k.reading), [0, 1, 2, 3, 4]);
  close(ticks[1].t, 1.25);
  close(ticks[1].x, 0.75);
});

test('ticks carry across a turn in the path', () => {
  const away = [{ t: -4, x: 0 }, { t: 0, x: 2.4 }, { t: 4, x: 0 }];
  const ticks = clockTicks(away, 1);
  assert.equal(ticks.length, 7); // 0..6, the trip lasts 6.4
  const fourth = ticks[4]; // 4 s on the clock: 0.8 s into the return leg
  close(fourth.t, 0 + 0.8 / 0.8);
  close(fourth.x, 2.4 - 0.6);
});

test('ticks can start from a reading other than zero', () => {
  const ticks = clockTicks([{ t: 0, x: 0 }, { t: 2, x: 0 }], 0.5, 10);
  assert.deepEqual(ticks.map((k) => k.reading), [10, 10.5, 11, 11.5, 12]);
});

test('positionAt follows the path and is null outside it', () => {
  const p = [{ t: 0, x: 0 }, { t: 2, x: 1 }, { t: 4, x: 1 }];
  close(positionAt(p, 1), 0.5);
  close(positionAt(p, 3), 1);
  assert.equal(positionAt(p, 5), null);
});

test('a flash catches a slower walker', () => {
  const meet = lightMeets({ t: 0, x: -2 }, 1, 0.5, 0);
  close(meet.t, 4);
  close(meet.x, 2);
  assert.equal(lightMeets({ t: 0, x: 0 }, 1, 1, 1), null);
  assert.equal(lightMeets({ t: 0, x: 0 }, -1, 0, 1), null, 'a leftward flash never reaches something on its right');
});
