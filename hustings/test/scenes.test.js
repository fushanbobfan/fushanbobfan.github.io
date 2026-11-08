import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENES, COLORS, LETTERS, MAX_CANDIDATES,
  sceneCandidates, placeNewCandidate, encodeState, decodeState, clampPoint,
} from '../src/scenes.js';
import { voterCloud } from '../src/voters.js';
import { METHODS } from '../src/methods.js';
import { createMap, fillAll, shares, condorcetMisses } from '../src/map.js';

test('every scene fits the palette and stays on the board', () => {
  assert.equal(COLORS.length, MAX_CANDIDATES);
  assert.equal(LETTERS.length, MAX_CANDIDATES);
  for (const s of SCENES) {
    assert.ok(s.candidates.length >= 2 && s.candidates.length <= MAX_CANDIDATES, s.id);
    for (const p of sceneCandidates(s)) {
      assert.equal(clampPoint(p.x), p.x);
      assert.equal(clampPoint(p.y), p.y);
    }
  }
});

function sceneMap(id, res = 32) {
  const s = SCENES.find((x) => x.id === id);
  return fillAll(createMap({
    res, candidates: sceneCandidates(s), cloud: voterCloud(151, 1), spread: s.spread, methods: METHODS,
  }));
}

const idx = (id) => METHODS.findIndex((m) => m.id === id);

test('centre squeeze: the moderate holds less ground under instant runoff than under minimax', () => {
  const map = sceneMap('squeeze');
  const irv = shares(map, idx('irv'))[1];
  const mm = shares(map, idx('minimax'))[1];
  assert.ok(irv < mm - 0.1, `${irv} vs ${mm}`);
  assert.ok(condorcetMisses(map, idx('irv')) > 0.05);
});

test('in every scene a Condorcet winner exists in nearly every cell', () => {
  for (const s of SCENES) {
    const map = sceneMap(s.id, 24);
    const none = map.condorcet.filter((c) => c < 0).length / map.condorcet.length;
    assert.ok(none < 0.02, `${s.id}: ${none}`);
  }
});

test('a new candidate stands clear of the others', () => {
  const cands = sceneCandidates(SCENES[0]);
  const p = placeNewCandidate(cands);
  const gap = Math.min(...cands.map((c) => Math.hypot(c.x - p.x, c.y - p.y)));
  assert.ok(gap > 0.2, String(gap));
  assert.deepEqual(placeNewCandidate(cands), p);
});

test('the link fragment round-trips and rejects junk', () => {
  const cands = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.125 }];
  const back = decodeState('#' + encodeState(cands, 0.17));
  assert.deepEqual(back, { candidates: cands, spread: 0.17 });
  assert.equal(decodeState('#c=oops'), null);
  assert.equal(decodeState(''), null);
  const clamped = decodeState('#c=-1,2;0.5,0.5&s=9');
  assert.deepEqual(clamped.candidates[0], { x: 0.03, y: 0.97 });
  assert.equal(clamped.spread, 0.2);
});
