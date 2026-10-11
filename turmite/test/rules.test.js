import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRule, MAX_COLORS } from '../src/rules.js';

test('letters become quarter turns, one colour each', () => {
  const r = parseRule('rl');
  assert.ok(r.ok);
  assert.equal(r.rule.text, 'RL');
  assert.equal(r.rule.colors, 2);
  assert.deepEqual([...r.rule.turns], [1, -1]);
  assert.deepEqual([...parseRule('N U').rule.turns], [0, 2]);
  assert.equal(parseRule('L, L, R, R').rule.text, 'LLRR');
});

test('too short, too long or unknown letters are refused with a reason', () => {
  assert.match(parseRule('R').error, /at least 2/);
  assert.match(parseRule('').error, /at least 2/);
  assert.match(parseRule('R'.repeat(MAX_COLORS + 1)).error, /At most 16/);
  assert.match(parseRule('RLX').error, /"X"/);
  assert.ok(parseRule('R'.repeat(MAX_COLORS)).ok);
});

test('hexagonal rules read turn tokens in sixths', () => {
  const r = parseRule('l1 r2 n u L2 r1', 'hex');
  assert.ok(r.ok);
  assert.equal(r.rule.text, 'L1R2NUL2R1');
  assert.deepEqual(r.rule.tokens, ['L1', 'R2', 'N', 'U', 'L2', 'R1']);
  assert.deepEqual([...r.rule.turns], [-1, 2, 0, 3, -2, 1]);
  assert.equal(r.rule.directions, 6);
  assert.equal(parseRule('RL').rule.directions, 4);
});

test('hexagonal rules refuse square letters and stray digits', () => {
  assert.match(parseRule('RL', 'hex').error, /"RL".*R1, R2/);
  assert.match(parseRule('R1R3', 'hex').error, /"R3"/);
  assert.match(parseRule('R1', 'hex').error, /at least 2 turns/);
  assert.match(parseRule('R1R2', 'cube').error, /Unknown lattice/);
});
