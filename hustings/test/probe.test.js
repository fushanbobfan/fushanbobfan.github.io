import test from 'node:test';
import assert from 'node:assert/strict';
import { electionAt } from '../src/probe.js';
import { SCENES, sceneCandidates } from '../src/scenes.js';
import { voterCloud } from '../src/voters.js';
import { METHODS } from '../src/methods.js';

const squeeze = SCENES.find((s) => s.id === 'squeeze');
const at = (x) => electionAt({
  point: { x, y: 0.5 }, candidates: sceneCandidates(squeeze), spread: squeeze.spread, cloud: voterCloud(151, 1),
});
const winner = (e, id) => e.results[METHODS.findIndex((m) => m.id === id)].winner;

test('in the middle of the centre squeeze the runoffs drop the Condorcet winner', () => {
  const e = at(0.5);
  assert.equal(e.condorcet, 1);
  assert.ok(e.first[1] < e.first[0] && e.first[1] < e.first[2]);
  assert.notEqual(winner(e, 'irv'), 1);
  assert.notEqual(winner(e, 'runoff'), 1);
  assert.equal(winner(e, 'minimax'), 1);
});

test('just left of the middle the far candidate drops first and B wins the instant runoff', () => {
  const e = at(0.43);
  const irv = e.results[METHODS.findIndex((m) => m.id === 'irv')];
  assert.equal(irv.rounds[0].eliminated, 2);
  assert.equal(irv.winner, 1);
});

test('approval elects the candidate standing halfway between the other two', () => {
  for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) assert.equal(winner(at(x), 'approval'), 1, String(x));
});
