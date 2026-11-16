import test from 'node:test';
import assert from 'node:assert/strict';
import { describePair, fmt } from '../src/readout.js';

const frames = [{ name: 'Lab', beta: 0 }, { name: 'Rocket', beta: 0.6 }];

test('fmt never shows negative zero, and keeps tiny real values visible', () => {
  assert.equal(fmt(-1e-12), '0.00');
  assert.equal(fmt(-1.234), '-1.23');
  assert.equal(fmt(0.0025), '0.0025');
  assert.equal(fmt(-0.0001), '-0.00010');
});

test('a nearly simultaneous pair is not called simultaneous in the lab', () => {
  const { rows, facts } = describePair({ t: 0, x: -4 }, { t: 0.02, x: 4 }, frames);
  const text = facts.sentences.join(' ');
  assert.doesNotMatch(text, /The lab itself/);
  assert.match(text, /0\.0025c/);
  assert.equal(rows[0].when, 'A first');
  const clock = describePair({ t: -4, x: 0 }, { t: 4, x: 0.02 }, frames).facts.sentences.join(' ');
  assert.doesNotMatch(clock, /at rest in the lab/);
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

test('two events on one point are not described as joined by light', () => {
  const { facts } = describePair({ t: 1, x: 1 }, { t: 1, x: 1 }, frames);
  assert.equal(facts.kind, 'same');
  assert.doesNotMatch(facts.sentences.join(' '), /light/);
});

test('a lightlike pair says light connects them', () => {
  const { facts } = describePair({ t: 2, x: 1 }, { t: 0, x: 3 }, frames);
  assert.equal(facts.kind, 'lightlike');
  assert.match(facts.sentences[0], /leaving B arrives exactly at A/);
});

test('a pair already simultaneous or colocated in the lab says so plainly', () => {
  const sim = describePair({ t: 0, x: -1 }, { t: 0, x: 1 }, frames).facts.sentences.join(' ');
  assert.match(sim, /The lab itself sees them happen at the same moment/);
  assert.doesNotMatch(sim, /0\.00c/);
  const same = describePair({ t: 0, x: 1 }, { t: 3, x: 1 }, frames).facts.sentences.join(' ');
  assert.match(same, /A clock at rest in the lab is present at both/);
});
