// Rows, changes and place notation for change ringing.
// A row is an array of bell numbers (1 = treble) read from the front, so
// row[0] is the bell ringing first. A change is a permutation of positions.

const BELL_CHARS = '1234567890ET';

export function bellChar(bell) {
  return BELL_CHARS[bell - 1];
}

export function bellFromChar(ch) {
  const i = BELL_CHARS.indexOf(ch.toUpperCase());
  if (i < 0) throw new Error(`"${ch}" is not a bell`);
  return i + 1;
}

export function rounds(stage) {
  return Array.from({ length: stage }, (_, i) => i + 1);
}

export function rowString(row) {
  return row.map(bellChar).join('');
}

export function sameRow(a, b) {
  return a.length === b.length && a.every((bell, i) => bell === b[i]);
}

// Turn one change written as places ("14", "x", "-") into the list of
// positions (0-based) each place takes its next bell from. Every bell not
// making a place swaps with a neighbour. Notation may leave out lead and
// lie places: if an odd number of bells sit in front of the first place
// written, the bell in front makes a place too (so "4" on six is "14"), and
// likewise at the back (so "1" on six is "16"). An odd gap between two places
// written cannot be filled and is refused.
export function parseChange(token, stage) {
  const places = new Set();
  if (token !== 'x' && token !== 'X' && token !== '-') {
    for (const ch of token) {
      const p = bellFromChar(ch);
      if (p > stage) throw new Error(`place ${ch} is beyond the stage of ${stage} bells`);
      places.add(p - 1);
    }
  } else if (stage % 2 === 1) {
    throw new Error('a cross change needs an even number of bells');
  }
  if (places.size > 0) {
    const sorted = [...places].sort((a, b) => a - b);
    if (sorted[0] % 2 === 1) places.add(0);
    if ((stage - 1 - sorted[sorted.length - 1]) % 2 === 1) places.add(stage - 1);
    for (let k = 1; k < sorted.length; k++) {
      if ((sorted[k] - sorted[k - 1] - 1) % 2 === 1) {
        throw new Error(`"${token}" leaves an odd number of bells between two places`);
      }
    }
  } else if (stage % 2 === 1) {
    places.add(stage - 1);
  }
  const perm = new Array(stage);
  let i = 0;
  while (i < stage) {
    if (places.has(i)) {
      perm[i] = i;
      i += 1;
    } else {
      perm[i] = i + 1;
      perm[i + 1] = i;
      i += 2;
    }
  }
  return perm;
}

export function applyChange(row, perm) {
  return perm.map((from) => row[from]);
}

function splitTokens(text) {
  const out = [];
  let cur = '';
  for (const ch of text.replace(/\s+/g, '')) {
    if (ch === 'x' || ch === 'X' || ch === '-') {
      if (cur) out.push(cur);
      out.push('x');
      cur = '';
    } else if (ch === '.') {
      if (cur) out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// A segment written after "&" is a palindrome: it is rung forwards and then
// back without repeating its middle change.
function reflect(tokens) {
  return tokens.concat(tokens.slice(0, -1).reverse());
}

// Parse a full lead of place notation into change tokens.
// "x16x16x16,12" is the usual short form: each side of the comma is a
// palindrome, so it reads as &x16x16x16 followed by &12.
// "&x1x1x1.2" style is also accepted, as is a plain list "3.1.5.3.1".
export function expandNotation(text) {
  const trimmed = text.replace(/\s+/g, '');
  if (trimmed.includes(',')) {
    return trimmed.split(',').flatMap((part) => reflect(splitTokens(part.replace(/^&/, ''))));
  }
  const pieces = trimmed.split(/(?=[&+])/);
  return pieces.flatMap((piece) => {
    if (piece.startsWith('&')) return reflect(splitTokens(piece.slice(1)));
    return splitTokens(piece.replace(/^\+/, ''));
  });
}

export function leadChanges(text, stage) {
  const tokens = expandNotation(text);
  if (tokens.length === 0) throw new Error('the notation has no changes');
  return tokens.map((t) => parseChange(t, stage));
}

// Ring a method's plain course: lead after lead from rounds until rounds
// comes back. Returns every row rung, ending with the closing rounds, and the
// lead heads met on the way. Stops after maxRows changes so a mistyped
// method cannot run forever.
export function plainCourse(changes, stage, maxRows = 5040) {
  const start = rounds(stage);
  const rows = [start];
  const leadHeads = [start];
  let row = start;
  for (;;) {
    for (const perm of changes) {
      if (rows.length > maxRows) return { rows, leadHeads, complete: false };
      row = applyChange(row, perm);
      rows.push(row);
    }
    if (sameRow(row, start)) return { rows, leadHeads, complete: true };
    leadHeads.push(row);
  }
}

// A touch is true when no row appears twice. The closing rounds is the
// opening rounds rung again and does not count against it.
export function falseRows(rows) {
  const seen = new Map();
  const repeats = [];
  const last = rows.length - 1;
  rows.forEach((row, i) => {
    if (i === last && i > 0 && sameRow(row, rows[0])) return;
    const key = rowString(row);
    if (seen.has(key)) repeats.push({ row: key, first: seen.get(key), again: i });
    else seen.set(key, i);
  });
  return repeats;
}

// Position (0-based) of a bell in every row: the "blue line" through the rows.
export function bellPath(rows, bell) {
  return rows.map((row) => row.indexOf(bell));
}
