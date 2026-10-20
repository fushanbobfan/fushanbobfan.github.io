// Run-length text for Lenia patterns, as used in Bert Chan's animal catalogue.
// Tokens: "." or "b" is 0, "o" is 255, "A".."X" are 1..24, and two-letter
// tokens "pA".."yO" carry on from 25 up to 255. A number before a token
// repeats it; "$" ends a row (a number before it skips extra rows), "!" ends
// the pattern. Values are scaled to [0, 1].

const TOKEN = /(\d*)([.b]|o|[p-y][A-X]|[A-X]|\$|!)/y;

export function tokenValue(tok) {
  if (tok === '.' || tok === 'b') return 0;
  if (tok === 'o') return 255;
  if (tok.length === 1) return tok.charCodeAt(0) - 64;
  return (tok.charCodeAt(0) - 112) * 24 + (tok.charCodeAt(1) - 65 + 25);
}

export function valueToken(v) {
  if (!(v >= 0 && v <= 255) || !Number.isInteger(v)) throw new RangeError(`value out of range: ${v}`);
  if (v === 0) return '.';
  if (v <= 24) return String.fromCharCode(64 + v);
  const k = v - 25;
  return String.fromCharCode(112 + Math.floor(k / 24)) + String.fromCharCode(65 + (k % 24));
}

// Returns { width, height, data } with data a row-major Float64Array in [0, 1].
export function decode(text) {
  const src = String(text).replace(/\s+/g, '');
  const rows = [[]];
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m) throw new SyntaxError(`unexpected "${src[pos]}" at ${pos}`);
    pos = TOKEN.lastIndex;
    const count = m[1] ? Number(m[1]) : 1;
    const tok = m[2];
    if (tok === '!') break;
    if (tok === '$') {
      for (let i = 0; i < count; i++) rows.push([]);
      continue;
    }
    const v = tokenValue(tok) / 255;
    const row = rows[rows.length - 1];
    for (let i = 0; i < count; i++) row.push(v);
  }
  while (rows.length > 1 && rows[rows.length - 1].length === 0) rows.pop();
  const height = rows.length;
  const width = Math.max(0, ...rows.map((r) => r.length));
  const data = new Float64Array(width * height);
  rows.forEach((r, y) => data.set(r, y * width));
  return { width, height, data };
}

// Encodes a grid back to run-length text, quantising to 255 levels.
export function encode({ width, height, data }) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const toks = [];
    for (let x = 0; x < width; x++) toks.push(valueToken(Math.round(Math.min(1, Math.max(0, data[y * width + x])) * 255)));
    while (toks.length && toks[toks.length - 1] === '.') toks.pop();
    let out = '';
    for (let i = 0; i < toks.length; ) {
      let j = i;
      while (j < toks.length && toks[j] === toks[i]) j++;
      out += (j - i > 1 ? String(j - i) : '') + toks[i];
      i = j;
    }
    rows.push(out);
  }
  return rows.join('$') + '!';
}
