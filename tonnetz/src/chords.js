// Major and minor triads: the 24 chords the Tonnetz is made of.
// A triad is { root: 0..11, quality: 'M' | 'm' }, optionally with `name`,
// the root as the user spelled it, so "A#" stays A# rather than becoming Bb.

import { mod12, pcName, parseNote, formatNote, spellAbove } from './pitch.js';

export const QUALITY_THIRD = { M: 4, m: 3 };

export function triad(root, quality, name) {
  const t = { root: mod12(root), quality };
  if (name) t.name = name;
  return t;
}

export function pitchClasses(t) {
  return [t.root, mod12(t.root + QUALITY_THIRD[t.quality]), mod12(t.root + 7)];
}

export function sameTriad(a, b) {
  return a.root === b.root && a.quality === b.quality;
}

// 0..23: majors C..B, then minors C..B. Handy as an array index.
export function triadIndex(t) {
  return (t.quality === 'M' ? 0 : 12) + t.root;
}

export function triadFromIndex(i) {
  return triad(i % 12, i < 12 ? 'M' : 'm');
}

export const ALL_TRIADS = Array.from({ length: 24 }, (_, i) => triadFromIndex(i));

export function rootName(t, spelling = 'auto') {
  return t.name ?? pcName(t.root, spelling);
}

export function chordName(t, spelling = 'auto') {
  return rootName(t, spelling) + (t.quality === 'm' ? 'm' : '');
}

// Long form for screen readers and the status line: "A-flat minor".
export function chordLongName(t, spelling = 'auto') {
  const r = rootName(t, spelling).replace(/#/g, '-sharp').replace(/(?<=[A-G])b/g, '-flat').replace(/-flatb/, '-double-flat');
  return `${r} ${t.quality === 'M' ? 'major' : 'minor'}`;
}

// Spells the three notes with consecutive letters: Ab major is Ab C Eb,
// F# major is F# A# C#, Ebm is Eb Gb Bb.
export function spellTriad(t, spelling = 'auto') {
  const root = parseNote(rootName(t, spelling));
  const [, third, fifth] = pitchClasses(t);
  return [
    formatNote(root.letter, root.accidental),
    spellAbove(root.letter, 2, third).name,
    spellAbove(root.letter, 4, fifth).name,
  ];
}

const MINOR_SUFFIX = /^(m|min|mi|-)$/;
const MAJOR_SUFFIX = /^(|M|maj|ma|Δ)$/;

// Parses "C", "Am", "F#", "Bbmin", "e♭m", "Dmaj". Lowercase roots with no
// suffix are read as minor ("a" = A minor), as in Riemannian notation.
// Returns a triad or null.
export function parseChord(text) {
  const m = /^\s*([A-Ga-g](?:#|♯|b|♭)*)(.*?)\s*$/u.exec(text);
  if (!m) return null;
  const note = parseNote(m[1]);
  if (!note) return null;
  const suffix = m[2];
  let quality;
  if (MINOR_SUFFIX.test(suffix)) quality = 'm';
  else if (MAJOR_SUFFIX.test(suffix)) quality = suffix === '' && m[1][0] === m[1][0].toLowerCase() ? 'm' : 'M';
  else return null;
  return triad(note.pc, quality, formatNote(note.letter, note.accidental));
}

// Splits a progression such as "C G Am F" or "C - G | Am, F" into chords.
// Returns { chords, errors } where errors lists tokens that did not parse.
export function parseProgression(text) {
  const chords = [];
  const errors = [];
  for (const token of text.split(/[\s,|;–—]+|\s-\s/u)) {
    if (!token || token === '-') continue;
    const c = parseChord(token);
    if (c) chords.push(c);
    else errors.push(token);
  }
  return { chords, errors };
}

// Finds the major or minor triad made of exactly these pitch classes.
export function identifyTriad(pcs) {
  const set = [...new Set(pcs.map(mod12))];
  if (set.length !== 3) return null;
  for (const t of ALL_TRIADS) {
    const own = pitchClasses(t);
    if (own.every((p) => set.includes(p))) return t;
  }
  return null;
}
