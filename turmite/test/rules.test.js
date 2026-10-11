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
