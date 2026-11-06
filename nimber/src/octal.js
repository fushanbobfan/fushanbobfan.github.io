// Octal games on a row of pins. In a code like 0.137 the k-th digit says what a
// player may do when removing k adjacent pins from a run: add 1 if the run may
// vanish, 2 if one run may remain, 4 if two runs may remain.

export function parseCode(code) {
  const match = /^0\.([0-7]+)$/.exec(code);
  if (!match) throw new Error(`bad octal code ${code}`);
  return [0, ...[...match[1]].map(Number)];
}

// Every way to remove pins from a run of n: take from left + 1 to left + take.
export function runMoves(digits, n) {
  const moves = [];
  for (let take = 1; take < digits.length && take <= n; take++) {
    for (let left = 0; left + take <= n; left++) {
      const right = n - take - left;
      const runs = (left > 0 ? 1 : 0) + (right > 0 ? 1 : 0);
      if (digits[take] & (1 << runs)) moves.push({ left, take, right });
    }
  }
  return moves;
}

// g[n] is the smallest value no move from a run of n reaches, where a move's value
// is the nim-sum of the runs it leaves. A run of n plays exactly like a Nim pile of g[n].
export function grundyTable(code, size) {
  const digits = parseCode(code);
  const g = new Uint16Array(size + 1);
  const seen = new Int32Array(1 << 14).fill(-1);
  for (let n = 1; n <= size; n++) {
    for (let take = 1; take < digits.length && take <= n; take++) {
      const rest = n - take;
      const d = digits[take];
      if (rest === 0 && d & 1) seen[0] = n;
      if (rest > 0 && d & 2) seen[g[rest]] = n;
      if (d & 4) {
        for (let left = 1; left <= rest >> 1; left++) seen[g[left] ^ g[rest - left]] = n;
      }
    }
    let v = 0;
    while (seen[v] === n) v++;
    g[n] = v;
  }
  return g;
}

// Guy and Smith's test: for a game removing at most k pins at a time, if
// g[n + p] = g[n] for all n0 <= n < 2 n0 + p + k, the same holds for all n >= n0.
// Returns the smallest period this table proves, or null.
export function provePeriod(code, g) {
  const k = parseCode(code).length - 1;
  const last = g.length - 1;
  for (let p = 1; p <= last / 3; p++) {
    let n = last - p;
    while (n >= 0 && g[n + p] === g[n]) n--;
    const start = n + 1;
    if (2 * start + p + k <= last - p + 1) return { start, period: p, checkedTo: last };
  }
  return null;
}

export function runsOf(pins) {
  const runs = [];
  let i = 0;
  while (i < pins.length) {
    if (!pins[i]) { i++; continue; }
    const start = i;
    while (i < pins.length && pins[i]) i++;
    runs.push({ start, length: i - start });
  }
  return runs;
}

export function rowValue(pins, g) {
  return runsOf(pins).reduce((sum, run) => sum ^ g[run.length], 0);
}

export const GAMES = {
  kayles: {
    name: 'Kayles',
    code: '0.77',
    rule: 'Knock down one pin, or two pins standing side by side.',
    pin: 'single',
    gap: true,
  },
  dawson: {
    name: "Dawson's Kayles",
    code: '0.07',
    rule: 'Knock down exactly two pins standing side by side. Lone pins stay up, and the player with no pair left loses.',
    pin: null,
    gap: true,
  },
  chess: {
    name: "Dawson's Chess",
    code: '0.137',
    rule: 'Pick a pin. It falls, and so do the pins right beside it.',
    pin: 'neighbours',
    gap: false,
  },
  officers: {
    name: 'Officers',
    code: '0.6',
    rule: 'Knock down one pin, as long as it has a neighbour still standing. Lone pins stay up.',
    pin: 'single',
    gap: false,
  },
};

const tables = new Map();
export function tableFor(key, size = 1500) {
  if (!tables.has(key)) tables.set(key, grundyTable(GAMES[key].code, size));
  return tables.get(key);
}

export function rowRules(key) {
  const digits = parseCode(GAMES[key].code);
  const g = tableFor(key);
  const legalMoves = (pins) => runsOf(pins).flatMap((run) => runMoves(digits, run.length)
    .map((m) => ({ start: run.start + m.left, take: m.take })));
  return {
    key,
    legalMoves,
    applyMove(pins, { start, take }) {
      const next = pins.slice();
      next.fill(false, start, start + take);
      return next;
    },
    isWinning: (pins) => rowValue(pins, g) !== 0,
  };
}

function runAt(pins, i) {
  if (!pins[i]) return null;
  let a = i;
  let b = i;
  while (a > 0 && pins[a - 1]) a--;
  while (b + 1 < pins.length && pins[b + 1]) b++;
  return [a, b];
}

function ifLegal(key, pins, move) {
  const legal = rowRules(key).legalMoves(pins);
  return legal.some((m) => m.start === move.start && m.take === move.take) ? move : null;
}

// The move a click on pin i means in this game, or null.
export function pinMove(key, pins, i) {
  const run = runAt(pins, i);
  const style = GAMES[key].pin;
  if (!run || !style) return null;
  if (style === 'single') return ifLegal(key, pins, { start: i, take: 1 });
  const start = Math.max(run[0], i - 1);
  const end = Math.min(run[1], i + 1);
  return ifLegal(key, pins, { start, take: end - start + 1 });
}

// The move a click between pins i and i + 1 means, or null.
export function gapMove(key, pins, i) {
  if (!GAMES[key].gap || !pins[i] || !pins[i + 1]) return null;
  return ifLegal(key, pins, { start: i, take: 2 });
}

export const freshRow = (length) => new Array(length).fill(true);
