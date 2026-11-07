import test from 'node:test';
import assert from 'node:assert/strict';
import { countOpen, makeChannels, potassiumState, sodiumState } from '../src/gates.js';

test('a large crowd opens in the share the equations give', () => {
  const crowd = makeChannels(40000, 40000);
  const gates = { m: 0.8, h: 0.6, n: 0.7 };
  const open = countOpen(crowd, gates);
  assert.ok(Math.abs(open.sodium / 40000 - 0.8 ** 3 * 0.6) < 0.01);
  assert.ok(Math.abs(open.potassium / 40000 - 0.7 ** 4) < 0.01);
});

test('raising a gating variable never closes a gate', () => {
  const [channel] = makeChannels(1, 0).sodium;
  let opened = 0;
  for (let m = 0; m <= 1; m += 0.01) {
    const count = sodiumState(channel, m, 1).gates.filter(Boolean).length;
    assert.ok(count >= opened);
    opened = count;
  }
  assert.equal(opened, 3);
});

test('a sodium channel with its ball shut stays closed whatever m does', () => {
  const [channel] = makeChannels(1, 0).sodium;
  assert.equal(sodiumState(channel, 1, 0).open, false);
  assert.equal(sodiumState(channel, 1, 1).open, true);
});

test('a potassium channel needs all four gates', () => {
  const channel = { n: [0.1, 0.2, 0.3, 0.9] };
  assert.equal(potassiumState(channel, 0.5).open, false);
  assert.equal(potassiumState(channel, 0.95).open, true);
});

test('the same seed gives the same crowd', () => {
  assert.deepEqual(makeChannels(3, 3), makeChannels(3, 3));
});
