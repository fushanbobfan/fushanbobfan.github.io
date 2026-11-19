import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveChoice, encodeLink, decodeLink } from '../src/link.js';
import { sceneById } from '../src/scenes.js';

const small = {
  left: [[0, 1, 2], [0, 2, 1], [1, 0, 2]],
  right: [[1, 0, 2], [0, 1, 2], [0, 1, 2]],
};

test('moving a name up or down a list, clamped at both ends', () => {
  let { prefs, pos } = moveChoice(small, 'left', 1, 2, -1);
  assert.deepEqual(prefs.left[1], [0, 1, 2]);
  assert.equal(pos, 1);
  assert.deepEqual(prefs.right, small.right, 'the other side is untouched');
  assert.deepEqual(small.left[1], [0, 2, 1], 'the original lists are not changed');
  ({ prefs, pos } = moveChoice(small, 'right', 0, 0, -1));
  assert.equal(prefs, small);
  assert.equal(pos, 0);
  ({ prefs, pos } = moveChoice(small, 'right', 0, 0, 5));
  assert.deepEqual(prefs.right[0], [0, 2, 1]);
  assert.equal(pos, 2);
});

test('links carry the lists, the proposing side and the mode', () => {
  const link = encodeLink({ prefs: small, proposer: 'right', mode: 'hand' });
  assert.equal(link, 'L=012.021.102&R=102.012.012&p=right&m=hand');
  assert.deepEqual(decodeLink('#' + link), { prefs: small, proposer: 'right', mode: 'hand' });
  assert.equal(encodeLink({ prefs: small, proposer: 'left', mode: 'watch' }).includes('m='), false);
});

test('every scene and size round-trips', () => {
  for (const id of ['random', 'agree', 'cyclic', 'rivals']) {
    for (let n = 2; n <= 8; n++) {
      const prefs = sceneById(id).make(n, 9);
      assert.deepEqual(decodeLink(encodeLink({ prefs, proposer: 'left', mode: 'edit' })).prefs, prefs);
    }
  }
});

test('bad links are refused', () => {
  for (const bad of [
    '', '#', '#L=012&R=012', '#L=01.10&R=01', '#L=00.10&R=01.10', '#L=0x.10&R=01.10',
    '#L=0.0&R=0.0', '#L=012345678.0&R=0', '#L=01.12&R=01.10',
  ]) {
    assert.equal(decodeLink(bad), null, bad);
  }
  const odd = decodeLink('#L=01.10&R=10.01&p=sideways&m=dance');
  assert.deepEqual(odd, { prefs: { left: [[0, 1], [1, 0]], right: [[1, 0], [0, 1]] }, proposer: 'left', mode: 'watch' });
});
