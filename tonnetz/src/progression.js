// Turns a list of chords into a path on the lattice: each chord change is
// replaced by its shortest P/L/R word, and the word is walked triangle by
// triangle from wherever the previous chord sat.

import { chordName, sameTriad } from './chords.js';
import { shortestWord } from './plr.js';
import { walk, triangleTriad, nearestTriangleOf, triangleCentroid } from './lattice.js';

export const PRESETS = [
  { key: 'pop', name: 'Four-chord pop (I–V–vi–IV)', text: 'C G Am F C' },
  { key: 'pachelbel', name: 'Pachelbel canon', text: 'D A Bm F#m G D G A D' },
  { key: 'andalusian', name: 'Andalusian cadence', text: 'Am G F E Am' },
  { key: 'hexatonic', name: 'Hexatonic cycle (PL)', text: 'C Cm Ab Abm E Em C' },
  { key: 'octatonic', name: 'Octatonic cycle (PR)', text: 'C Cm Eb Ebm F# F#m A Am C' },
  { key: 'thirds', name: 'Falling-thirds chain (RL)', text: 'C Am F Dm Bb Gm Eb Cm Ab Fm Db Bbm Gb Ebm B G#m E C#m A F#m D Bm G Em C' },
  { key: 'fifths', name: 'Circle of fifths', text: 'C G D A E B F# Db Ab Eb Bb F C' },
  { key: 'mediants', name: 'Major-third cycle', text: 'C E Ab C' },
];

// Returns { steps, path } where steps[i] describes the change into chord i
// ({ chord, word, from, to }, with from/to indices into path) and path is
// the full list of triangles walked, starting at the first chord's triangle
// nearest `origin` (a screen point, default the lattice origin).
export function tracePath(chords, origin = { x: 0.5, y: -0.3 }) {
  if (!chords.length) return { steps: [], path: [] };
  const first = nearestTriangleOf(chords[0], origin.x, origin.y);
  const path = [first];
  const steps = [{ chord: chords[0], word: '', from: 0, to: 0 }];
  for (let i = 1; i < chords.length; i++) {
    const here = path[path.length - 1];
    const word = shortestWord(triangleTriad(here), chords[i]);
    const from = path.length - 1;
    const walked = walk(here, word);
    path.push(...walked.slice(1));
    steps.push({ chord: chords[i], word, from, to: path.length - 1 });
  }
  return { steps, path };
}

// Total number of P/L/R moves in a traced progression.
export function pathLength(trace) {
  return trace.steps.reduce((s, st) => s + st.word.length, 0);
}

// The box around a path's centroids, padded, for fitting the view.
export function pathBounds(path, pad = 1) {
  if (!path.length) return { x0: -pad, x1: pad, y0: -pad, y1: pad };
  const cs = path.map(triangleCentroid);
  const xs = cs.map((c) => c.x);
  const ys = cs.map((c) => c.y);
  return {
    x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad,
    y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad,
  };
}

// Plain-text summary such as "C –LR→ G –R→ Em".
export function describe(trace, spelling = 'auto') {
  return trace.steps.map((st, i) => {
    const name = chordName(st.chord, spelling);
    if (i === 0) return name;
    if (st.word === '') return `= ${name}`;
    return `–${st.word}→ ${name}`;
  }).join(' ');
}

// True when two consecutive chords are the same triad (a held chord).
export function isRepeat(trace, i) {
  return i > 0 && sameTriad(trace.steps[i].chord, trace.steps[i - 1].chord);
}
