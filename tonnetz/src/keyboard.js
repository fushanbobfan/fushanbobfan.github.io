// Layout of a piano keyboard strip. Widths are in white-key units: white
// keys sit side by side, black keys are narrower and straddle the gap
// between their neighbours.

import { mod12 } from './pitch.js';

const BLACK = new Set([1, 3, 6, 8, 10]);
export const BLACK_WIDTH = 0.6;

export function isBlack(midi) {
  return BLACK.has(mod12(midi));
}

// Keys from `low` to `high` inclusive. Returns { keys, width } where each
// key is { midi, pc, black, x, w } and width is the number of white keys.
export function keyboardLayout(low = 48, high = 83) {
  if (isBlack(low)) low -= 1;
  if (isBlack(high)) high += 1;
  const keys = [];
  let white = 0;
  for (let m = low; m <= high; m++) {
    if (isBlack(m)) {
      keys.push({ midi: m, pc: mod12(m), black: true, x: white - BLACK_WIDTH / 2, w: BLACK_WIDTH });
    } else {
      keys.push({ midi: m, pc: mod12(m), black: false, x: white, w: 1 });
      white++;
    }
  }
  return { keys, width: white };
}

// MIDI note name with octave, C4 = 60.
export function midiLabel(midi, names) {
  return `${names[mod12(midi)]}${Math.floor(midi / 12) - 1}`;
}
