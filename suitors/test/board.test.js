import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBoard, narrate, ordinal, boardHeight } from '../src/board.js';
import { compareProposers, summarize, renderComparison } from '../src/results.js';
import { deferredAcceptance, replay, flip } from '../src/matching.js';
import { sceneById, LEFT_NAMES, RIGHT_NAMES } from '../src/scenes.js';

const small = {
  left: [[0, 1, 2], [0, 2, 1], [1, 0, 2]],
  right: [[1, 0, 2], [0, 1, 2], [0, 1, 2]],
};
const names = { left: ['Ada', 'Ben', 'Cass'], right: ['Ivo', 'June', 'Kai'] };
const count = (s, re) => (s.match(re) || []).length;

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
});

test('every step is narrated in plain words', () => {
  const { events } = deferredAcceptance(small);
  assert.match(narrate(null, names, 'left', small), /Nobody has proposed/);
  assert.equal(narrate(events[0], names, 'left', small), 'Ada proposes to Ivo, their 1st choice. Ivo has no offer yet and holds on to Ada.');
  assert.equal(narrate(events[1], names, 'left', small), 'Ben proposes to Ivo, their 1st choice. Ivo likes Ben better than Ada, holds Ben and lets Ada go.');
  assert.equal(narrate(events[3], names, 'left', small), 'Cass proposes to June, their 1st choice. June would rather keep Ada, so Cass must try further down the list.');
});

test('narration follows the right side when it proposes', () => {
  const { events } = deferredAcceptance(flip(small));
  assert.match(narrate(events[0], names, 'right', small), /^Ivo proposes to Ben, their 1st choice\./);
});

test('the board shows one line per held offer and marks what was asked', () => {
  const { events } = deferredAcceptance(small);
  const at = (k, proposer = 'left') => {
    const { holding, asked } = replay(3, events, k);
    return renderBoard({ names, prefs: small, proposer, holding, asked, current: k ? events[k - 1] : null });
  };
  assert.equal(count(at(0).markup, /class="held/g), 0);
  assert.equal(count(at(2).markup, /class="held/g), 1);
  assert.equal(count(at(2).markup, /class="let-go"/g), 1);
  assert.equal(count(at(4).markup, /class="turned-away"/g), 1);
  const end = at(events.length).markup;
  assert.equal(count(end, /class="held/g), 3);
  // Cass asked June and Ivo before Kai: two struck chips.
  assert.equal(count(end, /class="strike"/g), 3);
  assert.equal(at(0).height, boardHeight(3));
});

test('names are escaped in the markup', () => {
  const odd = { left: ['<b>', 'Ben', 'Cass'], right: names.right };
  const { markup } = renderBoard({ names: odd, prefs: small, proposer: 'left', holding: [-1, -1, -1], asked: [0, 0, 0], current: null });
  assert.ok(!markup.includes('<b>'));
  assert.ok(markup.includes('&lt;b&gt;'));
});

test('only proposers ever do better under their own rule', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const n = 3 + (seed % 6);
    const prefs = sceneById('random').make(n, seed);
    const cmp = compareProposers(prefs);
    cmp.left.ranks.right.forEach((r, j) => assert.ok(r >= cmp.right.ranks.right[j]));
    cmp.left.ranks.left.forEach((r, i) => assert.ok(r <= cmp.right.ranks.left[i]));
    const html = renderComparison(cmp, { left: LEFT_NAMES.slice(0, n), right: RIGHT_NAMES.slice(0, n) }, 'left');
    assert.equal(count(html, /<tr><td>/g), 2 * n);
  }
});

test('the summary says when proposing makes no difference', () => {
  assert.match(summarize(compareProposers(sceneById('agree').make(5))), /exactly one stable pairing/);
  const cyc = compareProposers(sceneById('cyclic').make(4));
  assert.equal(cyc.stableCount, 4);
  assert.equal(cyc.left.leftAverage, 1);
  assert.equal(cyc.right.rightAverage, 1);
  assert.match(summarize(cyc), /^These lists have 4 stable pairings\./);
});
