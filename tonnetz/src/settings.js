// Share-link settings. Only values that differ from the defaults are written,
// and anything out of range is clamped or dropped on the way back in.

import { SPELLINGS, pcName } from './pitch.js';
import { parseNotes } from './chordset.js';
import { parseChord, chordName } from './chords.js';

export const DEFAULTS = {
  progression: 'C G Am F C',
  tempo: 72,
  spelling: 'auto',
  labels: 'both',
  chord: 'C',
  held: '',
};

export const TEMPO_RANGE = [30, 200];
export const LABEL_MODES = ['notes', 'chords', 'both'];
const MAX_PROGRESSION = 400;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalise(s) {
  const out = { ...DEFAULTS };
  if (typeof s.progression === 'string') out.progression = s.progression.slice(0, MAX_PROGRESSION);
  const tempo = Number(s.tempo);
  if (Number.isFinite(tempo)) out.tempo = Math.round(clamp(tempo, ...TEMPO_RANGE));
  if (s.spelling in SPELLINGS) out.spelling = s.spelling;
  if (LABEL_MODES.includes(s.labels)) out.labels = s.labels;
  if (typeof s.chord === 'string') {
    const c = parseChord(s.chord);
    if (c) out.chord = chordName(c);
  }
  if (typeof s.held === 'string') {
    // Held notes keep the order they were added in (the first is the bass),
    // without repeats, at most twelve.
    out.held = heldToText(heldFromText(s.held).slice(0, 12));
  }
  return out;
}

export function heldToText(pcs) {
  return pcs.map((pc) => pcName(pc)).join(' ');
}

export function heldFromText(text) {
  const seen = [];
  for (const pc of parseNotes(text).pcs) if (!seen.includes(pc)) seen.push(pc);
  return seen;
}

const KEYS = { progression: 'p', tempo: 't', spelling: 's', labels: 'l', chord: 'c', held: 'h' };

export function encode(settings) {
  const s = normalise(settings);
  const params = new URLSearchParams();
  for (const [k, short] of Object.entries(KEYS)) {
    if (s[k] !== DEFAULTS[k]) params.set(short, String(s[k]));
  }
  return params.toString();
}

export function decode(query) {
  const params = new URLSearchParams(query.replace(/^[#?]/, ''));
  const raw = {};
  for (const [k, short] of Object.entries(KEYS)) {
    if (params.has(short)) raw[k] = params.get(short);
  }
  return normalise(raw);
}
