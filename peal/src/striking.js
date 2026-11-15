// When each bell strikes, and what it sounds like.

// Rows alternate handstroke and backstroke, starting with a handstroke.
// Bells strike evenly within a row, and every handstroke row starts after an
// extra gap of one blow: the "open handstroke lead" that gives ringing its
// lilt. With gap = 1 a pair of rows takes 2 * stage + 1 blows.
export function blowTime(rowIndex, place, stage, interval, gap = 1) {
  const pairs = Math.floor(rowIndex / 2);
  const back = rowIndex % 2;
  const blowsBefore = pairs * (2 * stage + gap) + gap + back * stage + place;
  return blowsBefore * interval;
}

// Inverse of blowTime: which row and place is sounding at time t, or the
// next one to sound if t falls in the handstroke gap.
export function blowAt(t, stage, interval, gap = 1) {
  const blow = Math.max(0, Math.floor(t / interval + 1e-9));
  const pairLength = 2 * stage + gap;
  const pairs = Math.floor(blow / pairLength);
  let inPair = blow - pairs * pairLength - gap;
  if (inPair < 0) return { row: pairs * 2, place: 0, inGap: true };
  const back = inPair >= stage ? 1 : 0;
  inPair -= back * stage;
  return { row: pairs * 2 + back, place: inPair, inGap: false };
}

// Interval between blows for a given peal speed: the time a full peal of
// 5040 rows would take, in hours, the way ringers quote it.
export function intervalForPealSpeed(hours, stage, gap = 1) {
  const blows = 2520 * (2 * stage + gap);
  return (hours * 3600) / blows;
}

// A ring of bells is tuned to a major scale with the tenor as its keynote:
// six bells are doh to lah, eight a full octave, twelve run on above it.
// Returns semitones above the tenor for bell `bell` of a ring of `stage`.
const MAJOR_FROM_KEYNOTE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];

export function semitonesAboveTenor(bell, stage) {
  return MAJOR_FROM_KEYNOTE[stage - bell];
}

export function bellFrequency(bell, stage, tenorHz = 330) {
  return tenorHz * 2 ** (semitonesAboveTenor(bell, stage) / 12);
}

// The main partials of a tuned church bell relative to its strike note
// (the nominal): hum two octaves below, prime an octave below, a tierce a
// minor third above the prime, quint, the nominal and two partials above
// it. Lower partials ring on longer.
export const PARTIALS = [
  { name: 'hum', ratio: 0.25, gain: 0.35, decay: 3.2 },
  { name: 'prime', ratio: 0.5, gain: 0.45, decay: 2.2 },
  { name: 'tierce', ratio: 0.6, gain: 0.35, decay: 1.6 },
  { name: 'quint', ratio: 0.75, gain: 0.2, decay: 1.2 },
  { name: 'nominal', ratio: 1, gain: 0.6, decay: 1.0 },
  { name: 'superquint', ratio: 1.5, gain: 0.2, decay: 0.6 },
  { name: 'octave nominal', ratio: 2, gain: 0.12, decay: 0.4 },
];
