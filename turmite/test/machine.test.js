import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMachine, looksLikeMachine, transitionTable, machineText } from '../src/machine.js';
import { parseRule } from '../src/rules.js';

test('braces and digits read the same Fibonacci machine', () => {
  const a = parseMachine('{{{1,8,1},{1,8,1}},{{1,2,1},{0,1,0}}}');
  const b = parseMachine('181181121010');
  assert.ok(a.ok && b.ok);
  assert.deepEqual(a.rule, b.rule);
  const r = a.rule;
  assert.equal(r.text, '181181121010');
  assert.deepEqual([r.states, r.colors], [2, 2]);
  assert.deepEqual([...r.write], [1, 1, 1, 0]);
  assert.deepEqual([...r.turn], [-1, -1, 1, 0]);
  assert.deepEqual([...r.next], [1, 1, 1, 0]);
});

test("Langton's ant as a machine matches its relative rule", () => {
  const m = parseMachine('120080').rule;
  const t = transitionTable(parseRule('RL').rule);
  assert.deepEqual([m.states, m.colors], [1, 2]);
  assert.deepEqual([...m.write], [...t.write]);
  assert.deepEqual([...m.turn], [...t.turn]);
  assert.deepEqual([...m.next], [...t.next]);
});

test('digit rules take the fewest colours that fit', () => {
  // Writes colour 2, so at least three colours: six triples as 2 states x 3.
  const r = parseMachine('121 220 080 111 041 011').rule;
  assert.deepEqual([r.states, r.colors], [2, 3]);
  assert.match(parseMachine('1201').error, /run of triples/);
  assert.match(parseMachine('125').error, /do not fit/);
});

test('bad tables are refused with a reason', () => {
  assert.match(parseMachine('{{{1,3,0},{0,8,0}}}').error, /Turn code 3/);
  assert.match(parseMachine('{{{2,2,0},{0,8,0}}}').error, /writes colour 2/);
  assert.match(parseMachine('{{{1,2,1},{0,8,0}}}').error, /goes to state 1/);
  assert.match(parseMachine('{{{1,2,0},{0,8,0}},{{1,2,0}}}').error, /same number/);
  assert.match(parseMachine('{{{1,2,0}}').error, /braces/);
  assert.match(parseMachine('{{{1,2,0}}}').error, /at least two colours/);
  assert.match(parseMachine('{x}').error, /Write a machine/);
});

test('large tables print with braces, and machines are told apart from letters', () => {
  const colors = 12;
  const row = Array.from({ length: colors }, (_, c) => `{${(c + 1) % colors},2,0}`).join(',');
  const r = parseMachine(`{{${row}}}`).rule;
  assert.equal(r.colors, 12);
  assert.ok(r.text.startsWith('{{{1,2,0},'));
  assert.deepEqual(parseMachine(r.text).rule, r);
  assert.equal(machineText(parseMachine('120080').rule), '120080');
  assert.ok(looksLikeMachine(' 181181121010') && looksLikeMachine('{{{'));
  assert.ok(!looksLikeMachine('RL') && !looksLikeMachine('L1R1'));
});
