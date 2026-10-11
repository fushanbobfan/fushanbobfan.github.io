// Rules for relative turmites on the square grid: one letter per colour,
// giving the turn the ant makes when it stands on that colour.
//   L  turn left      R  turn right
//   N  no turn        U  turn around
// Turns are counted in quarter turns clockwise.

export const TURNS = { L: -1, R: 1, N: 0, U: 2 };
export const MIN_COLORS = 2;
export const MAX_COLORS = 16;

export function parseRule(text) {
  const clean = String(text ?? '').toUpperCase().replace(/[\s,]+/g, '');
  if (clean.length < MIN_COLORS) {
    return { ok: false, error: `A rule needs at least ${MIN_COLORS} letters, one per colour.` };
  }
  if (clean.length > MAX_COLORS) {
    return { ok: false, error: `At most ${MAX_COLORS} colours (letters).` };
  }
  const bad = clean.replace(/[LRNU]/g, '');
  if (bad) {
    return { ok: false, error: `Unknown letter "${bad[0]}": use L, R, N or U.` };
  }
  const turns = Int8Array.from(clean, (ch) => TURNS[ch]);
  return { ok: true, rule: { text: clean, colors: clean.length, turns } };
}
