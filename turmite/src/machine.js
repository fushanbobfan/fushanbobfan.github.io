// State-machine turmites: a two-dimensional Turing machine. The ant carries
// an internal state, and for each pair (state, colour under it) the rule
// gives a triple {write colour, turn, next state}.
//
// Written the way Ed Pegg Jr. and Golly do:
//   {{{1,8,1},{1,8,1}},{{1,2,1},{0,1,0}}}
// one group per state, one triple per colour; or as the same digits run
// together, 181181121010. Turn codes: 1 no turn, 2 right, 4 U-turn, 8 left.

import { MAX_COLORS } from './rules.js';

export const MAX_STATES = 16;
const TURN_CODES = { 1: 0, 2: 1, 4: 2, 8: -1 };
export const TURN_CODE_OF = { 0: 1, 1: 2, 2: 4, [-1]: 8 };

export function looksLikeMachine(text) {
  return /^\s*[\d{[]/.test(String(text ?? ''));
}

function fail(error) {
  return { ok: false, error };
}

// Nested [state][colour][write, turn, next] from either notation.
function readTriples(text) {
  const clean = String(text).replace(/\s+/g, '');
  if (/^\d+$/.test(clean)) {
    if (clean.length % 3) return fail('A digit rule is a run of triples: write colour, turn, next state.');
    const flat = [];
    for (let i = 0; i < clean.length; i += 3) flat.push([+clean[i], +clean[i + 1], +clean[i + 2]]);
    // The digits do not say how many colours there are: take the fewest
    // (at least two) that every triple fits.
    const maxWrite = Math.max(...flat.map((t) => t[0]));
    for (let colors = Math.max(2, maxWrite + 1); colors <= flat.length; colors++) {
      if (flat.length % colors) continue;
      const states = flat.length / colors;
      if (flat.every((t) => t[2] < states)) {
        return { ok: true, table: Array.from({ length: states }, (_, s) => flat.slice(s * colors, (s + 1) * colors)) };
      }
    }
    return fail('These triples do not fit any number of colours and states.');
  }
  if (!/^[{[][\d,{}[\]]*[}\]]$/.test(clean)) return fail('Write a machine as {{{write,turn,next},...},...} or as digits.');
  let table;
  try {
    table = JSON.parse(clean.replace(/{/g, '[').replace(/}/g, ']'));
  } catch {
    return fail('The braces do not match up.');
  }
  const shaped =
    Array.isArray(table) &&
    table.length > 0 &&
    table.every((row) => Array.isArray(row) && row.length === table[0].length) &&
    table.flat().every((t) => Array.isArray(t) && t.length === 3 && t.every(Number.isInteger));
  if (!shaped) return fail('Each state needs one {write,turn,next} triple per colour, the same number for every state.');
  return { ok: true, table };
}

export function parseMachine(text) {
  const read = readTriples(text);
  if (!read.ok) return read;
  const { table } = read;
  const states = table.length;
  const colors = table[0].length;
  if (colors < 2) return fail('A machine needs at least two colours.');
  if (colors > MAX_COLORS) return fail(`At most ${MAX_COLORS} colours.`);
  if (states > MAX_STATES) return fail(`At most ${MAX_STATES} states.`);
  const write = new Uint8Array(states * colors);
  const turn = new Int8Array(states * colors);
  const next = new Uint8Array(states * colors);
  for (let s = 0; s < states; s++) {
    for (let c = 0; c < colors; c++) {
      const [w, t, n] = table[s][c];
      if (w >= colors) return fail(`State ${s}, colour ${c} writes colour ${w}, but there are only ${colors}.`);
      if (!(t in TURN_CODES)) return fail(`Turn code ${t} at state ${s}, colour ${c}: use 1, 2, 4 or 8.`);
      if (n >= states) return fail(`State ${s}, colour ${c} goes to state ${n}, but there are only ${states}.`);
      const k = s * colors + c;
      write[k] = w;
      turn[k] = TURN_CODES[t];
      next[k] = n;
    }
  }
  return {
    ok: true,
    rule: {
      kind: 'machine',
      lattice: 'square',
      directions: 4,
      text: machineText({ states, colors, write, turn, next }),
      colors,
      states,
      tokens: Array.from({ length: colors }, (_, c) => String(c)),
      write,
      turn,
      next,
    },
  };
}

// Digits when every value is a single digit, braces otherwise.
export function machineText({ states, colors, write, turn, next }) {
  const triples = [];
  for (let k = 0; k < states * colors; k++) triples.push([write[k], TURN_CODE_OF[turn[k]], next[k]]);
  if (triples.flat().every((v) => v < 10)) return triples.flat().join('');
  const groups = [];
  for (let s = 0; s < states; s++) {
    groups.push(`{${triples.slice(s * colors, (s + 1) * colors).map((t) => `{${t.join(',')}}`).join(',')}}`);
  }
  return `{${groups.join(',')}}`;
}

// Every rule as a transition table. A relative rule is a one-state machine
// that always paints the next colour.
export function transitionTable(rule) {
  if (rule.kind === 'machine') return rule;
  const { colors, turns } = rule;
  return {
    states: 1,
    colors,
    write: Uint8Array.from({ length: colors }, (_, c) => (c + 1) % colors),
    turn: Int8Array.from(turns),
    next: new Uint8Array(colors),
  };
}
