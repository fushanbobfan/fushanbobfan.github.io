import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triad, ALL_TRIADS, chordName, pitchClasses } from '../src/chords.js';
import { TRANSFORMS, applyWord, shortestWord, distanceTable, cycle, movingVoice, voiceLead, closeVoicing } from '../src/plr.js';

const C = triad(0, 'M');
const names = (ts) => ts.map((t) => chordName(t));

test('P, L and R send C major to C minor, E minor and A minor', () => {
  assert.equal(chordName(TRANSFORMS.P(C)), 'Cm');
  assert.equal(chordName(TRANSFORMS.L(C)), 'Em');
  assert.equal(chordName(TRANSFORMS.R(C)), 'Am');
  assert.equal(chordName(TRANSFORMS.L(triad(9, 'm'))), 'F');
  assert.equal(chordName(TRANSFORMS.R(triad(4, 'm'))), 'G');
});

test('each transformation is an involution that keeps exactly two notes', () => {
  for (const t of ALL_TRIADS) {
    for (const k of 'PLR') {
      const u = TRANSFORMS[k](t);
      assert.deepEqual(TRANSFORMS[k](u), t);
      assert.notEqual(u.quality, t.quality);
      const shared = pitchClasses(t).filter((p) => pitchClasses(u).includes(p));
      assert.equal(shared.length, 2, `${k} on ${chordName(t)}`);
    }
  }
});

test('words apply left to right', () => {
  assert.equal(chordName(applyWord(C, 'PL')), 'Ab');
  assert.equal(chordName(applyWord(C, 'RL')), 'F');
  assert.equal(chordName(applyWord(C, '')), 'C');
  assert.throws(() => applyWord(C, 'Q'));
});

test('shortest words connect every pair and reproduce the target', () => {
  for (const a of ALL_TRIADS) {
    for (const b of ALL_TRIADS) {
      const w = shortestWord(a, b);
      assert.notEqual(w, null);
      assert.deepEqual(applyWord(a, w), b);
    }
  }
  assert.equal(shortestWord(C, triad(7, 'M')), 'LR');
  assert.equal(shortestWord(C, triad(5, 'M')), 'RL');
  assert.equal(shortestWord(C, C), '');
});

test('the distance table is symmetric with diameter five', () => {
  const d = distanceTable();
  let max = 0;
  for (let i = 0; i < 24; i++) {
    assert.equal(d[i][i], 0);
    for (let j = 0; j < 24; j++) {
      assert.equal(d[i][j], d[j][i]);
      max = Math.max(max, d[i][j]);
    }
  }
  assert.equal(max, 5);
});

test('PL, PR and LR cycles have six, eight and twenty-four chords', () => {
  assert.deepEqual(names(cycle(C, 'PL')), ['C', 'Cm', 'Ab', 'Abm', 'E', 'Em']);
  assert.deepEqual(names(cycle(C, 'PR')), ['C', 'Cm', 'Eb', 'Ebm', 'F#', 'F#m', 'A', 'Am']);
  assert.equal(cycle(C, 'LR').length, 24);
  assert.equal(new Set(names(cycle(C, 'LR'))).size, 24);
});

test('the moving voice is reported with its signed step', () => {
  assert.deepEqual(movingVoice(C, TRANSFORMS.P(C)), { from: 4, to: 3, semitones: -1 });
  assert.deepEqual(movingVoice(C, TRANSFORMS.L(C)), { from: 0, to: 11, semitones: -1 });
  assert.deepEqual(movingVoice(C, TRANSFORMS.R(C)), { from: 7, to: 9, semitones: 2 });
  assert.equal(movingVoice(C, triad(2, 'M')), null);
});

test('voice leading moves one voice for each transformation', () => {
  const v = [60, 64, 67];
  assert.deepEqual(voiceLead(v, TRANSFORMS.P(C)), [60, 63, 67]);
  assert.deepEqual(voiceLead(v, TRANSFORMS.L(C)), [59, 64, 67]);
  assert.deepEqual(voiceLead(v, TRANSFORMS.R(C)), [60, 64, 69]);
});

test('voice leading covers all chord tones and keeps moves small', () => {
  const v = [60, 64, 67];
  const g = voiceLead(v, triad(7, 'M'));
  assert.deepEqual(g.map((n) => n % 12).sort((a, b) => a - b), [2, 7, 11]);
  assert.equal(g.reduce((s, n, i) => s + Math.abs(n - v[i]), 0), 3);
  assert.deepEqual(voiceLead([48, 60, 64, 67], triad(9, 'm')).length, 4);
  assert.deepEqual(voiceLead([], C), []);
});

test('close voicings sit in root position near the requested note', () => {
  assert.deepEqual(closeVoicing(C, 64), [60, 64, 67]);
  assert.deepEqual(closeVoicing(triad(9, 'm'), 64), [57, 60, 64]);
});
