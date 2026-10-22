// Naming arbitrary sets of pitch classes: triads beyond major and minor,
// seventh chords and two-note intervals. On the lattice a major or minor
// seventh chord is two triangles sharing an edge (Cmaj7 = C + Em,
// Am7 = Am + C), so held notes are also matched against the triangles they
// fill.

import { mod12, pcName, parseNote, intervalName } from './pitch.js';

// Interval sets above the root. Order matters: when a set matches several
// types, earlier entries are listed first.
export const CHORD_TYPES = [
  { key: 'maj', symbol: '', name: 'major', intervals: [0, 4, 7] },
  { key: 'min', symbol: 'm', name: 'minor', intervals: [0, 3, 7] },
  { key: 'dim', symbol: 'dim', name: 'diminished', intervals: [0, 3, 6] },
  { key: 'aug', symbol: 'aug', name: 'augmented', intervals: [0, 4, 8] },
  { key: 'sus4', symbol: 'sus4', name: 'suspended fourth', intervals: [0, 5, 7] },
  { key: 'sus2', symbol: 'sus2', name: 'suspended second', intervals: [0, 2, 7] },
  { key: 'maj7', symbol: 'maj7', name: 'major seventh', intervals: [0, 4, 7, 11] },
  { key: '7', symbol: '7', name: 'dominant seventh', intervals: [0, 4, 7, 10] },
  { key: 'm7', symbol: 'm7', name: 'minor seventh', intervals: [0, 3, 7, 10] },
  { key: 'm7b5', symbol: 'm7b5', name: 'half-diminished seventh', intervals: [0, 3, 6, 10] },
  { key: 'dim7', symbol: 'dim7', name: 'diminished seventh', intervals: [0, 3, 6, 9] },
  { key: 'mmaj7', symbol: 'm(maj7)', name: 'minor-major seventh', intervals: [0, 3, 7, 11] },
  { key: 'augmaj7', symbol: 'maj7#5', name: 'augmented major seventh', intervals: [0, 4, 8, 11] },
];

export function normaliseSet(pcs) {
  return [...new Set(pcs.map(mod12))].sort((a, b) => a - b);
}

// Every reading of the set as a chord: [{ root, type, symbol, name }].
// Symmetric chords give several readings (augmented triads three, the
// diminished seventh four). A bass pitch class, when given, puts readings
// rooted on it first.
export function nameSet(pcs, { spelling = 'auto', bass = null } = {}) {
  const set = normaliseSet(pcs);
  const out = [];
  for (const type of CHORD_TYPES) {
    if (type.intervals.length !== set.length) continue;
    for (const root of set) {
      const own = type.intervals.map((i) => mod12(root + i));
      if (own.every((p) => set.includes(p))) {
        out.push({
          root,
          type: type.key,
          symbol: pcName(root, spelling) + type.symbol,
          name: `${pcName(root, spelling)} ${type.name}`,
        });
      }
    }
  }
  if (bass !== null) {
    const b = mod12(bass);
    out.sort((x, y) => (x.root === b ? 0 : 1) - (y.root === b ? 0 : 1));
  }
  return out;
}

// A short description of any set: a chord name, an interval, a single
// note, or a plain list when nothing fits.
export function describeSet(pcs, opts = {}) {
  const set = normaliseSet(pcs);
  const spelling = opts.spelling ?? 'auto';
  if (set.length === 0) return 'No notes held';
  if (set.length === 1) return pcName(set[0], spelling);
  if (set.length === 2) {
    // Measured up from the bass when one is given, otherwise as the smaller
    // of the two inversions.
    const [a, b] = set;
    const bass = opts.bass === null || opts.bass === undefined ? null : mod12(opts.bass);
    const up = mod12(b - a);
    let lo;
    let size;
    if (bass === a) [lo, size] = [a, up];
    else if (bass === b) [lo, size] = [b, 12 - up];
    else [lo, size] = up <= 6 ? [a, up] : [b, 12 - up];
    return `${pcName(lo, spelling)}–${pcName(mod12(lo + size), spelling)}: ${intervalName(size)}`;
  }
  const names = nameSet(set, opts);
  if (names.length) return names.map((n) => n.symbol).join(' = ');
  return set.map((p) => pcName(p, spelling)).join(' ');
}

// Parses a list of note names such as "C E G Bb" or "c,e,g".
export function parseNotes(text) {
  const pcs = [];
  const errors = [];
  for (const token of text.split(/[\s,]+/)) {
    if (!token) continue;
    const n = parseNote(token);
    if (n) pcs.push(n.pc);
    else errors.push(token);
  }
  return { pcs, errors };
}

export function toggle(pcs, pc) {
  const p = mod12(pc);
  return pcs.includes(p) ? pcs.filter((x) => x !== p) : [...pcs, p];
}
