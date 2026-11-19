import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deferredAcceptance, replay, blockingPairs, isStable, allStableMatchings,
  partnerRanks, flip, invert, validatePrefs,
} from '../src/matching.js';
import { SCENES, sceneById } from '../src/scenes.js';

// Three on a side: left 0 and 1 both want right 0 first.
const small = {
  left: [[0, 1, 2], [0, 2, 1], [1, 0, 2]],
  right: [[1, 0, 2], [0, 1, 2], [0, 1, 2]],
};

function* permutations(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  const c = new Array(n).fill(0);
  yield a.slice();
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const k = i % 2 ? c[i] : 0;
      [a[k], a[i]] = [a[i], a[k]];
      yield a.slice();
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

// The same algorithm with free proposers served first-come first-served instead of last-in first-out.
function fifoProposals(prefs) {
  const n = prefs.left.length;
  const next = new Array(n).fill(0);
  const holding = new Array(n).fill(-1);
  const queue = Array.from({ length: n }, (_, i) => n - 1 - i);
  while (queue.length) {
    const p = queue.shift();
    const r = prefs.left[p][next[p]++];
    const h = holding[r];
    if (h === -1) holding[r] = p;
    else if (prefs.right[r].indexOf(p) < prefs.right[r].indexOf(h)) { holding[r] = p; queue.push(h); }
    else queue.push(p);
  }
  return invert(holding);
}

test('deferred acceptance on a worked example', () => {
  const { match, events } = deferredAcceptance(small);
  // Left 0 asks right 0, left 1 asks right 0 and wins it, left 0 moves on to right 1.
  assert.deepEqual(match, [1, 0, 2]);
  assert.deepEqual(events.map((e) => [e.proposer, e.receiver, e.outcome]), [
    [0, 0, 'held'],
    [1, 0, 'swapped'],
    [0, 1, 'held'],
    [2, 1, 'rejected'],
    [2, 0, 'rejected'],
    [2, 2, 'held'],
  ]);
  assert.ok(isStable(small, match));
});

test('replay rebuilds the held offers after any number of steps', () => {
  const { events, match } = deferredAcceptance(small);
  assert.deepEqual(replay(3, events, 0).holding, [-1, -1, -1]);
  assert.deepEqual(replay(3, events, 2).holding, [1, -1, -1]);
  assert.deepEqual(replay(3, events, 2).asked, [1, 1, 0]);
  const end = replay(3, events, events.length);
  assert.deepEqual(invert(match), end.holding);
});

test('the result is stable and proposer-optimal on many random sets', () => {
  const scene = sceneById('random');
  for (let seed = 1; seed <= 60; seed++) {
    const n = 2 + (seed % 5);
    const prefs = scene.make(n, seed);
    const { match } = deferredAcceptance(prefs);
    assert.ok(isStable(prefs, match), `seed ${seed}`);
    const all = allStableMatchings(prefs);
    assert.ok(all.length >= 1);
    const mine = partnerRanks(prefs, match);
    for (const other of all) {
      const ranks = partnerRanks(prefs, other);
      // Every proposer does at least as well as in any other stable matching, every receiver at least as badly.
      ranks.left.forEach((r, i) => assert.ok(mine.left[i] <= r, `seed ${seed} left ${i}`));
      ranks.right.forEach((r, j) => assert.ok(mine.right[j] >= r, `seed ${seed} right ${j}`));
    }
    assert.deepEqual(all[0], match, `seed ${seed}: left-optimal comes first`);
    const rightProposes = invert(deferredAcceptance(flip(prefs)).match);
    assert.deepEqual(all[all.length - 1], rightProposes, `seed ${seed}: right-optimal comes last`);
  }
});

test('proposal order does not change the outcome, and the proposal count stays within n² − n + 1', () => {
  const scene = sceneById('random');
  for (let seed = 100; seed < 140; seed++) {
    const n = 2 + (seed % 7);
    const prefs = scene.make(n, seed);
    const { events } = deferredAcceptance(prefs);
    assert.ok(events.length <= n * n - n + 1, `seed ${seed}: ${events.length}`);
    assert.ok(events.length >= n);
    assert.deepEqual(fifoProposals(prefs), deferredAcceptance(prefs).match, `seed ${seed}`);
  }
});

test('the pruned search finds exactly the stable pairings found by brute force', () => {
  const scene = sceneById('random');
  for (let seed = 7; seed < 27; seed++) {
    const n = 3 + (seed % 3);
    const prefs = scene.make(n, seed);
    const brute = [];
    for (const p of permutations(n)) if (isStable(prefs, p)) brute.push(p.join());
    assert.deepEqual(allStableMatchings(prefs).map((m) => m.join()).sort(), brute.sort(), `seed ${seed}`);
  }
});

test('blocking pairs are found in a hand-made pairing', () => {
  // Pair everyone straight across: left 1 and right 0 both prefer each other to what they got.
  // Straight across: left 1 got its last choice and both right 0 and right 2 would rather have left 1.
  assert.deepEqual(blockingPairs(small, [0, 1, 2]), [[1, 0], [1, 2]]);
  // Left 0 unmatched blocks with anyone who would take them; left 2 would leave right 2 for the free right 1.
  assert.deepEqual(blockingPairs(small, [-1, 0, 2]), [[0, 1], [0, 2], [2, 1]]);
});

test('scenes deal valid lists of every size', () => {
  for (const scene of SCENES) {
    for (let n = 2; n <= 8; n++) {
      assert.equal(validatePrefs(scene.make(n, 42)), n, scene.id);
    }
  }
});

test('when everyone agrees there is one stable matching; opposed tastes give n of them', () => {
  for (let n = 2; n <= 8; n++) {
    const agree = sceneById('agree').make(n);
    assert.equal(allStableMatchings(agree).length, 1);
    assert.deepEqual(deferredAcceptance(agree).match, Array.from({ length: n }, (_, i) => i));
    const cyclic = sceneById('cyclic').make(n);
    const all = allStableMatchings(cyclic);
    assert.equal(all.length, n, `n = ${n}`);
    // Left proposing gives every left person their first choice; right proposing gives the right theirs.
    assert.ok(partnerRanks(cyclic, all[0]).left.every((r) => r === 0));
    assert.ok(partnerRanks(cyclic, all[n - 1]).right.every((r) => r === 0));
  }
});

test('bad lists are refused', () => {
  assert.throws(() => validatePrefs({ left: [[0, 0]], right: [[0]] }));
  assert.throws(() => validatePrefs({ left: [[0, 1], [1, 0]], right: [[0, 1]] }));
  assert.throws(() => validatePrefs({ left: [[0, 2], [1, 0]], right: [[0, 1], [1, 0]] }));
});
