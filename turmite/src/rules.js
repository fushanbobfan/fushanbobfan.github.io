// Rules for relative turmites: one turn per colour, the turn the ant makes
// when it stands on that colour.
//
// Square grid, one letter per colour, turns in quarter turns clockwise:
//   L  turn left      R  turn right
//   N  no turn        U  turn around
//
// Hexagonal grid, one token per colour, turns in sixths clockwise:
//   N  no turn    R1 60° right   R2 120° right
//   U  turn around   L2 120° left   L1 60° left

export const LATTICES = {
  square: { directions: 4, turns: { L: -1, R: 1, N: 0, U: 2 }, token: /[LRNU]/y },
  hex: { directions: 6, turns: { N: 0, R1: 1, R2: 2, U: 3, L2: -2, L1: -1 }, token: /N|U|[LR][12]/y },
};

export const TURNS = LATTICES.square.turns;
export const MIN_COLORS = 2;
export const MAX_COLORS = 16;

export function parseRule(text, lattice = 'square') {
  const spec = LATTICES[lattice];
  if (!spec) return { ok: false, error: `Unknown lattice "${lattice}".` };
  const clean = String(text ?? '').toUpperCase().replace(/[\s,]+/g, '');
  const tokens = [];
  spec.token.lastIndex = 0;
  while (spec.token.lastIndex < clean.length) {
    const at = spec.token.lastIndex;
    const m = spec.token.exec(clean);
    if (!m) {
      const hint = lattice === 'hex' ? 'use N, R1, R2, U, L2 or L1' : 'use L, R, N or U';
      return { ok: false, error: `Cannot read "${clean.slice(at, at + 2)}": ${hint}.` };
    }
    tokens.push(m[0]);
  }
  const unit = lattice === 'hex' ? 'turns' : 'letters';
  if (tokens.length < MIN_COLORS) {
    return { ok: false, error: `A rule needs at least ${MIN_COLORS} ${unit}, one per colour.` };
  }
  if (tokens.length > MAX_COLORS) {
    return { ok: false, error: `At most ${MAX_COLORS} colours (${unit}).` };
  }
  return {
    ok: true,
    rule: {
      lattice,
      directions: spec.directions,
      text: tokens.join(''),
      tokens,
      colors: tokens.length,
      turns: Int8Array.from(tokens, (t) => spec.turns[t]),
    },
  };
}
