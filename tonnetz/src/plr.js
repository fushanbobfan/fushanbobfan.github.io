// Neo-Riemannian transformations. Each of P, L and R keeps two notes of a
// triad and moves the third by a semitone or a whole tone, swapping major and
// minor. All three are involutions, and together they reach all 24 triads.

import { triad, triadIndex, triadFromIndex, pitchClasses } from './chords.js';
import { mod12, nearestMidi } from './pitch.js';

export const TRANSFORMS = {
  // Parallel: C major <-> C minor. The third moves a semitone.
  P: (t) => triad(t.root, t.quality === 'M' ? 'm' : 'M'),
  // Leading-tone exchange: C major <-> E minor. The root of the major chord
  // drops a semitone to the leading tone.
  L: (t) => (t.quality === 'M' ? triad(t.root + 4, 'm') : triad(t.root - 4, 'M')),
  // Relative: C major <-> A minor. The fifth of the major chord rises a tone.
  R: (t) => (t.quality === 'M' ? triad(t.root - 3, 'm') : triad(t.root + 3, 'M')),
};

export const TRANSFORM_NAMES = { P: 'Parallel', L: 'Leading-tone exchange', R: 'Relative' };

// Applies a word such as "PLR" left to right.
export function applyWord(t, word) {
  let cur = triad(t.root, t.quality);
  for (const ch of word.toUpperCase()) {
    if (!TRANSFORMS[ch]) throw new Error(`unknown transformation ${ch}`);
    cur = TRANSFORMS[ch](cur);
  }
  return cur;
}

// Shortest P/L/R word from a to b, found by breadth-first search over the
// 24 triads. Among words of equal length the first in P < L < R order wins.
export function shortestWord(a, b) {
  const start = triadIndex(a);
  const goal = triadIndex(b);
  const word = new Array(24).fill(null);
  word[start] = '';
  const queue = [start];
  while (queue.length) {
    const i = queue.shift();
    if (i === goal) return word[i];
    for (const k of ['P', 'L', 'R']) {
      const j = triadIndex(TRANSFORMS[k](triadFromIndex(i)));
      if (word[j] === null) {
        word[j] = word[i] + k;
        queue.push(j);
      }
    }
  }
  return null;
}

// Distance in P/L/R steps between every pair of triads.
export function distanceTable() {
  return Array.from({ length: 24 }, (_, i) =>
    Array.from({ length: 24 }, (_, j) => shortestWord(triadFromIndex(i), triadFromIndex(j)).length));
}

// Repeats a word from `t` until the chord comes back; returns the cycle of
// triads (without repeating the start). PL gives the hexatonic cycle of six
// chords, PR the octatonic cycle of eight, LR the 24-chord cycle.
export function cycle(t, word) {
  const out = [triad(t.root, t.quality)];
  for (let guard = 0; guard < 48; guard++) {
    for (const ch of word) {
      const next = TRANSFORMS[ch](out[out.length - 1]);
      if (next.root === t.root && next.quality === t.quality) return out;
      out.push(next);
    }
  }
  return out;
}

// Which note moves when going from a to b, if they share two notes.
// Returns { from, to, semitones } with semitones the signed smallest step,
// or null if the chords share fewer than two notes.
export function movingVoice(a, b) {
  const pa = pitchClasses(a);
  const pb = pitchClasses(b);
  const gone = pa.filter((p) => !pb.includes(p));
  const added = pb.filter((p) => !pa.includes(p));
  if (gone.length !== 1) return null;
  let d = mod12(added[0] - gone[0]);
  if (d > 6) d -= 12;
  return { from: gone[0], to: added[0], semitones: d };
}

// Moves each voice of a voicing (an array of MIDI notes, any size) to a note
// of the target triad so that the total distance moved is as small as
// possible and every chord tone is covered when there are at least three
// voices. Returns the new voicing in the same voice order.
export function voiceLead(voicing, target) {
  const pcs = pitchClasses(target);
  const n = voicing.length;
  if (n === 0) return [];
  let best = null;
  let bestCost = Infinity;
  // Each voice is assigned a chord tone; with three or more voices every
  // assignment must use all three tones.
  const total = 3 ** n;
  for (let code = 0; code < total; code++) {
    const assign = [];
    let c = code;
    for (let v = 0; v < n; v++) {
      assign.push(c % 3);
      c = Math.floor(c / 3);
    }
    if (n >= 3 && new Set(assign).size < 3) continue;
    let cost = 0;
    const notes = assign.map((a, v) => nearestMidi(pcs[a], voicing[v]));
    for (let v = 0; v < n; v++) cost += Math.abs(notes[v] - voicing[v]);
    if (cost < bestCost) {
      bestCost = cost;
      best = notes;
    }
  }
  return best;
}

// A close root-position voicing of a triad around a given MIDI note.
export function closeVoicing(t, around = 60) {
  const [r, third, fifth] = pitchClasses(t);
  const root = nearestMidi(r, around - 4);
  return [root, root + mod12(third - r), root + mod12(fifth - r)];
}
