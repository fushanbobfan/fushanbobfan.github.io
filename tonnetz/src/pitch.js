// Pitch classes, note names and frequencies.
// A pitch class is an integer 0..11 with C = 0. MIDI note 60 is middle C.

export const mod12 = (n) => ((n % 12) + 12) % 12;

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Root names for each pitch class under the three spelling choices.
export const SPELLINGS = {
  sharps: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  flats: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  // The spelling most lead sheets use: flats except F#.
  auto: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
};

export function pcName(pc, spelling = 'auto') {
  return (SPELLINGS[spelling] ?? SPELLINGS.auto)[mod12(pc)];
}

// Parses a note name such as "C", "f#", "Bb", "E♭", "Cbb". Returns
// { letter, accidental, pc } or null.
export function parseNote(text) {
  const m = /^([A-Ga-g])((?:#|♯|b|♭|x|𝄪)*)$/u.exec(text.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase();
  let accidental = 0;
  for (const ch of m[2]) {
    if (ch === '#' || ch === '♯') accidental += 1;
    else if (ch === 'x' || ch === '𝄪') accidental += 2;
    else accidental -= 1;
  }
  if (Math.abs(accidental) > 2) return null;
  return { letter, accidental, pc: mod12(LETTER_PC[letter] + accidental) };
}

export function formatNote(letter, accidental) {
  if (accidental >= 0) return letter + '#'.repeat(accidental);
  return letter + 'b'.repeat(-accidental);
}

// Spells a note that sits `steps` letters above `letter` and has pitch class
// `pc`, e.g. the third of F# major is two letters above F# (A) and pc 10: A#.
export function spellAbove(letter, steps, pc) {
  const target = LETTERS[(LETTERS.indexOf(letter) + steps) % 7];
  let acc = mod12(pc - LETTER_PC[target]);
  if (acc > 6) acc -= 12;
  return { letter: target, accidental: acc, name: formatNote(target, acc) };
}

export function midiToFrequency(midi, a4 = 440) {
  return a4 * 2 ** ((midi - 69) / 12);
}

// Nearest MIDI note with pitch class `pc` to `midi`; ties go downward.
export function nearestMidi(pc, midi) {
  let d = mod12(pc - midi);
  if (d >= 6) d -= 12;
  return midi + d;
}

const INTERVAL_NAMES = [
  'unison', 'minor second', 'major second', 'minor third', 'major third', 'perfect fourth',
  'tritone', 'perfect fifth', 'minor sixth', 'major sixth', 'minor seventh', 'major seventh',
];

export function intervalName(semitones) {
  return INTERVAL_NAMES[mod12(semitones)];
}
