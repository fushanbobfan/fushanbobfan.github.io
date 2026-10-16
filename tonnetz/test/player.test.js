import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgression } from '../src/chords.js';
import { tracePath } from '../src/progression.js';
import { timeline, eventAt, pathVoicings } from '../src/player.js';

const trace = (text) => tracePath(parseProgression(text).chords);

test('each chord gets its beats and sounds once', () => {
  const tl = timeline(trace('C G Am F'), { tempo: 60, beats: 2 });
  assert.equal(tl.duration, 8);
  const sounded = tl.events.filter((e) => e.sound);
  assert.equal(sounded.length, 4);
  assert.deepEqual(sounded.map((e) => e.step), [0, 1, 2, 3]);
  for (let i = 1; i < tl.events.length; i++) assert.ok(tl.events[i].time >= tl.events[i - 1].time);
});

test('multi-move changes pass through their triangles in the first beat', () => {
  const tr = trace('C G');
  const tl = timeline(tr, { tempo: 120, beats: 4 });
  const passing = tl.events.filter((e) => !e.sound);
  assert.equal(passing.length, 1);
  assert.equal(passing[0].pathIndex, 1);
  const g = tl.events.find((e) => e.sound && e.step === 1);
  assert.equal(g.time, 2 + 0.5);
  assert.equal(g.duration, 1.5);
});

test('single moves sound on the downbeat with smooth voice leading', () => {
  const tl = timeline(trace('C Am F'), { tempo: 60, beats: 1 });
  const s = tl.events.filter((e) => e.sound);
  assert.deepEqual(s.map((e) => e.time), [0, 1, 2]);
  const moved = (a, b) => a.reduce((n, x, i) => n + (x !== b[i] ? 1 : 0), 0);
  assert.equal(moved(s[0].notes, s[1].notes), 1);
  assert.equal(moved(s[1].notes, s[2].notes), 1);
});

test('the event in force is found by time', () => {
  const tl = timeline(trace('C Am'), { tempo: 60, beats: 1 });
  assert.equal(eventAt(tl, -0.1), null);
  assert.equal(eventAt(tl, 0.5).step, 0);
  assert.equal(eventAt(tl, 1).step, 1);
});

test('path voicings change one note per triangle', () => {
  const tr = trace('C G D');
  const vs = pathVoicings(tr.path);
  assert.equal(vs.length, tr.path.length);
  for (let i = 1; i < vs.length; i++) {
    const changed = vs[i].filter((n, k) => n !== vs[i - 1][k]).length;
    assert.equal(changed, 1);
  }
});
