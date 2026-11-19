import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyHand, setPair, isComplete, handVerdict, stableTable } from '../src/hand.js';
import { renderBoard } from '../src/board.js';
import { deferredAcceptance, flip, invert } from '../src/matching.js';
import { sceneById } from '../src/scenes.js';

const small = {
  left: [[0, 1, 2], [0, 2, 1], [1, 0, 2]],
  right: [[1, 0, 2], [0, 1, 2], [0, 1, 2]],
};
const names = { left: ['Ada', 'Ben', 'Cass'], right: ['Ivo', 'June', 'Kai'] };

test('pairing splits up whoever either person was with, and pairing a couple again splits them', () => {
  let h = emptyHand(3);
  h = setPair(h, 0, 1);
  assert.deepEqual(h, [1, -1, -1]);
  h = setPair(h, 2, 1);
  assert.deepEqual(h, [-1, -1, 1]);
  h = setPair(h, 2, 0);
  assert.deepEqual(h, [-1, -1, 0]);
  h = setPair(h, 2, 0);
  assert.deepEqual(h, [-1, -1, -1]);
  assert.ok(!isComplete(h));
  assert.ok(isComplete([2, 0, 1]));
});

test('verdicts for empty, partial, unstable and stable pairings', () => {
  assert.match(handVerdict(small, emptyHand(3), names).text, /^Pick someone on the left/);
  // Ada with Ivo alone: no blocking pair among paired people yet.
  const partial = handVerdict(small, [0, -1, -1], names);
  assert.deepEqual(partial.pairs, []);
  assert.match(partial.text, /2 still to pair/);
  // Straight across: Ben and Ivo, and Ben and Kai, would rather be together.
  const across = handVerdict(small, [0, 1, 2], names);
  assert.deepEqual(across.pairs, [[1, 0], [1, 2]]);
  assert.equal(across.text, '2 blocking pairs would rather be together: Ben and Ivo (Ben has June, Ivo has Ada) and Ben and Kai (Ben has June, Kai has Cass).');
  const stable = handVerdict(small, deferredAcceptance(small).match, names);
  assert.deepEqual(stable.pairs, []);
  assert.match(stable.text, /^Stable/);
});

test('a partial pairing only reports blocking pairs between people who are already paired', () => {
  // Ben with June and Cass with Kai: Ben and Kai block (Ben ranks Kai over June, Kai ranks Ben over Cass).
  const v = handVerdict(small, [-1, 1, 2], names);
  assert.deepEqual(v.pairs, [[1, 2]]);
  assert.match(v.text, /^1 blocking pair would rather be together: Ben and Kai/);
});

test('long verdicts name three pairs and count the rest', () => {
  const prefs = sceneById('agree').make(6);
  // Reverse order: everyone gets their last choice, so almost every pair blocks.
  const v = handVerdict(prefs, [5, 4, 3, 2, 1, 0], { left: 'ABCDEF'.split(''), right: 'UVWXYZ'.split('') });
  assert.ok(v.pairs.length > 3);
  assert.ok(v.text.endsWith(`(A has Z, W has D) and ${v.pairs.length - 3} more.`), v.text);
});

test('the stable table runs from the left-optimal to the right-optimal pairing', () => {
  for (let seed = 3; seed < 23; seed++) {
    const prefs = sceneById('random').make(5, seed);
    const rows = stableTable(prefs);
    assert.deepEqual(rows[0].match, deferredAcceptance(prefs).match);
    assert.deepEqual(rows[rows.length - 1].match, invert(deferredAcceptance(flip(prefs)).match));
    for (let k = 1; k < rows.length; k++) assert.ok(rows[k].leftAverage >= rows[k - 1].leftAverage);
  }
});

test('in hand mode people are labelled buttons and blocking pairs are drawn', () => {
  const holding = invert([0, 1, 2]);
  const { markup } = renderBoard({
    names, prefs: small, proposer: 'left', holding, asked: [0, 0, 0], current: null,
    blocking: [[1, 0], [1, 2]], titles: { left: 'Left', right: 'Right' }, selected: { side: 'left', k: 1 }, interactive: true,
  });
  assert.equal((markup.match(/role="button"/g) || []).length, 6);
  assert.equal((markup.match(/class="blocking"/g) || []).length, 2);
  assert.ok(markup.includes('aria-label="Ben, paired with June"'));
  assert.ok(markup.includes('data-side="left" data-k="1" aria-pressed="true"'));
  assert.ok(markup.includes('>Left</text>'));
});
