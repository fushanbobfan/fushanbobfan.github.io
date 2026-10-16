import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgression, sameTriad, chordName } from '../src/chords.js';
import { neighbour, triangleTriad } from '../src/lattice.js';
import { PRESETS, tracePath, pathLength, pathBounds, describe, isRepeat } from '../src/progression.js';

const trace = (text) => tracePath(parseProgression(text).chords);

test('every preset parses cleanly', () => {
  const keys = new Set();
  for (const p of PRESETS) {
    const { chords, errors } = parseProgression(p.text);
    assert.deepEqual(errors, [], p.key);
    assert.ok(chords.length >= 3, p.key);
    keys.add(p.key);
  }
  assert.equal(keys.size, PRESETS.length);
});

test('a traced path is contiguous and ends each step on its chord', () => {
  for (const p of PRESETS) {
    const t = trace(p.text);
    for (let i = 1; i < t.path.length; i++) {
      const prev = t.path[i - 1];
      const adjacent = 'PLR'.split('').some((k) => {
        const n = neighbour(prev, k);
        return n.q === t.path[i].q && n.r === t.path[i].r && n.up === t.path[i].up;
      });
      assert.ok(adjacent, `${p.key} step ${i}`);
    }
    for (const st of t.steps) assert.ok(sameTriad(triangleTriad(t.path[st.to]), st.chord), p.key);
  }
});

test('cycles built from one or two moves trace in single steps', () => {
  const hex = trace(PRESETS.find((p) => p.key === 'hexatonic').text);
  assert.deepEqual(hex.steps.slice(1).map((s) => s.word), ['P', 'L', 'P', 'L', 'P', 'L']);
  const chain = trace(PRESETS.find((p) => p.key === 'thirds').text);
  assert.ok(chain.steps.slice(1).every((s) => s.word.length === 1));
  assert.equal(pathLength(chain), 24);
});

test('the four-chord loop needs eight moves, three of them for V to vi', () => {
  const t = trace('C G Am F C');
  assert.deepEqual(t.steps.slice(1).map((s) => s.word), ['LR', 'RLR', 'L', 'LR']);
  assert.equal(pathLength(t), 8);
});

test('repeated chords stay put and are flagged', () => {
  const t = trace('C C Am');
  assert.equal(t.steps[1].word, '');
  assert.equal(t.steps[1].from, t.steps[1].to);
  assert.ok(isRepeat(t, 1));
  assert.ok(!isRepeat(t, 2));
});

test('summaries name each move', () => {
  assert.equal(describe(trace('C G Em C')), 'C –LR→ G –R→ Em –L→ C');
  assert.equal(describe(trace('')), '');
  assert.equal(chordName(trace('a').steps[0].chord), 'Am');
});

test('bounds enclose the path with padding', () => {
  const t = trace('C G D A E');
  const b = pathBounds(t.path, 1);
  assert.ok(b.x1 - b.x0 > 2);
  assert.deepEqual(pathBounds([], 2), { x0: -2, x1: 2, y0: -2, y1: 2 });
});
