import test from 'node:test';
import assert from 'node:assert/strict';
import { runSteps, smoothStepTime } from '../src/pace.js';

function fakeClock(costPerStep) {
  let t = 0;
  return { now: () => t, step: () => { t += costPerStep; } };
}

test('cheap steps all run', () => {
  const c = fakeClock(2);
  assert.deepEqual(runSteps(8, c.step, c.now, 24), { done: 8, ms: 16 });
});

test('expensive steps stop at the budget but always run once', () => {
  const c = fakeClock(10);
  assert.deepEqual(runSteps(8, c.step, c.now, 24), { done: 3, ms: 30 });
  const slow = fakeClock(100);
  assert.deepEqual(runSteps(8, slow.step, slow.now, 24), { done: 1, ms: 100 });
});

test('step time smoothing starts from the first frame and moves part way', () => {
  assert.equal(smoothStepTime(0, { done: 4, ms: 8 }), 2);
  assert.equal(smoothStepTime(2, { done: 1, ms: 12 }, 0.5), 7);
  assert.equal(smoothStepTime(3, { done: 0, ms: 0 }), 3);
});
