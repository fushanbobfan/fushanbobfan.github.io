import test from 'node:test';
import assert from 'node:assert/strict';
import { describePair, fmt } from '../src/readout.js';

const frames = [{ name: 'Lab', beta: 0 }, { name: 'Rocket', beta: 0.6 }];

test('fmt never shows negative zero', () => {
  assert.equal(fmt(-0.0001), '0.00');
  assert.equal(fmt(-1.234), '-1.23');
});

test('a spacelike pair names the frame where it is simultaneous', () => {
  const { rows, facts } = describePair({ t: 0, x: 0 }, { t: 1, x: 2 }, frames);
  assert.equal(facts.kind, 'spacelike');
  assert.equal(facts.simultaneousBeta, 0.5);
  assert.ok(Math.abs(facts.properDistance - Math.sqrt(3)) < 1e-12);
  assert.equal(rows[0].when, 'A first');
  assert.equal(rows[1].when, 'B first'); // the rocket at 0.6c is past the flip at 0.5c
  assert.match(facts.sentences.join(' '), /0\.50c/);
  assert.match(facts.sentences.join(' '), /slower than that .* see A first; faster ones see B first/);
});

test('the order sentence follows the side the later event is on', () => {
  const { facts } = describePair({ t: 0, x: 0 }, { t: 1, x: -2 }, frames);
  assert.equal(facts.simultaneousBeta, -0.5);
  assert.match(facts.sentences.join(' '), /slower than that .* see B first; faster ones see A first/);
});

test('a timelike pair keeps its order in every row', () => {
  const { rows, facts } = describePair({ t: 0, x: 0 }, { t: 5, x: 3 }, frames, ['P', 'Q']);
  assert.equal(facts.kind, 'timelike');
  assert.equal(facts.properTime, 4);
  assert.equal(facts.colocatedBeta, 0.6);
  for (const r of rows) assert.equal(r.when, 'P first');
  assert.ok(Math.abs(rows[1].dx) < 1e-12, 'the rocket at 0.6c sees both at one place');
  assert.match(facts.sentences[0], /P comes first/);
});

test('a lightlike pair says light connects them', () => {
  const { facts } = describePair({ t: 2, x: 1 }, { t: 0, x: 3 }, frames);
  assert.equal(facts.kind, 'lightlike');
  assert.match(facts.sentences[0], /leaving B arrives exactly at A/);
});
