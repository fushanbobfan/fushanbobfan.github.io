import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describePattern, describeHalt } from '../src/describe.js';

test('highways, loops and the waiting states read naturally', () => {
  assert.equal(
    describePattern({ ants: 1, steps: 12288, highway: { period: 104, dx: -2, dy: 2, onset: 9977, onsetExact: true } }),
    'Highway since step 9,977: the ant repeats every 104 steps, moving 2 left and 2 down each time.',
  );
  assert.equal(
    describePattern({ ants: 1, steps: 9e4, highway: { period: 1968, dx: 16, dy: 0, onset: 50000, onsetExact: false } }),
    'Highway since before step 50,000: the ant repeats every 1,968 steps, moving 16 right each time.',
  );
  assert.equal(
    describePattern({ ants: 1, steps: 4096, highway: { period: 8, dx: 0, dy: 0, onset: 0, onsetExact: true } }),
    'Loop since step 0: the ant repeats every 8 steps without going anywhere.',
  );
  assert.match(describePattern({ ants: 1, steps: 100, highway: null }), /every 4,096 steps/);
  assert.match(describePattern({ ants: 1, steps: 50000, highway: null }), /No repeating pattern .* 50,000/);
  assert.match(describePattern({ ants: 3, steps: 50000, highway: null }), /single ant/);
});

test('halts explain themselves', () => {
  assert.equal(describeHalt(null, 4096), '');
  assert.match(describeHalt('edge', 4096), /4096 × 4096/);
});

test('hexagonal highways are told in cells and compass directions', () => {
  const hw = (dx, dy) =>
    describePattern({ ants: 1, steps: 2e5, lattice: 'hex', highway: { period: 698, dx, dy, onset: 101404, onsetExact: true } });
  assert.equal(
    hw(-21, 3),
    'Highway since step 101,404: the ant repeats every 698 steps, moving 21 cells west each time.',
  );
  assert.match(hw(0, 1), /1 cell south-east/);
  assert.match(hw(1, -2), /2 cells north each/);
  assert.match(hw(2, 0), /2 cells east/);
});
