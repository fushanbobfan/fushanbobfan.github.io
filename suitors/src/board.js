// Draws the two sides, their preference lists and the offers on the table as SVG markup.
// Pure string building, so it can be tested without a page.

export const ROW = 54;
export const TOP = 34;
export const WIDTH = 720;
export const CHIP = 22;
const LEFT_X = 236;
const RIGHT_X = WIDTH - LEFT_X;
const R = 17;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function boardHeight(n) {
  return TOP + n * ROW + 8;
}

export function rowY(k) {
  return TOP + k * ROW + ROW / 2;
}

// view: { names: {left, right}, prefs, proposer: 'left'|'right', holding (receiver -> proposer, in proposer-side terms),
//         asked (per proposer), current (the event just shown or null), blocking: [[l, r]] }
export function renderBoard(view) {
  const { names, prefs, proposer, holding, asked, current } = view;
  const n = prefs.left.length;
  const h = boardHeight(n);
  const parts = [];
  const props = proposer;
  const x = { left: LEFT_X, right: RIGHT_X };

  parts.push(`<text class="side-title" x="${LEFT_X}" y="16" text-anchor="middle">${proposer === 'left' ? 'Proposing' : 'Choosing'}</text>`);
  parts.push(`<text class="side-title" x="${RIGHT_X}" y="16" text-anchor="middle">${proposer === 'right' ? 'Proposing' : 'Choosing'}</text>`);

  // Offers being held.
  holding.forEach((p, r) => {
    if (p < 0) return;
    const [a, b] = props === 'left' ? [p, r] : [r, p];
    const fresh = current && current.outcome !== 'rejected' && current.receiver === r;
    parts.push(`<line class="held${fresh ? ' fresh' : ''}" x1="${LEFT_X + R}" y1="${rowY(a)}" x2="${RIGHT_X - R}" y2="${rowY(b)}"/>`);
  });

  if (current && current.outcome === 'rejected') {
    const [a, b] = props === 'left' ? [current.proposer, current.receiver] : [current.receiver, current.proposer];
    parts.push(`<line class="turned-away" x1="${LEFT_X + R}" y1="${rowY(a)}" x2="${RIGHT_X - R}" y2="${rowY(b)}"/>`);
  }
  if (current && current.outcome === 'swapped') {
    const [a, b] = props === 'left' ? [current.dropped, current.receiver] : [current.receiver, current.dropped];
    parts.push(`<line class="let-go" x1="${LEFT_X + R}" y1="${rowY(a)}" x2="${RIGHT_X - R}" y2="${rowY(b)}"/>`);
  }

  for (const [l, r] of view.blocking || []) {
    parts.push(`<line class="blocking" x1="${LEFT_X + R}" y1="${rowY(l)}" x2="${RIGHT_X - R}" y2="${rowY(r)}"/>`);
  }

  for (const side of ['left', 'right']) {
    const other = side === 'left' ? 'right' : 'left';
    const isProposer = side === props;
    for (let k = 0; k < n; k++) {
      const y = rowY(k);
      const cx = x[side];
      const partner = partnerOf(side, k, props, holding);
      const active = current && (side === props ? current.proposer === k : current.receiver === k);
      parts.push(`<g class="person ${side}${active ? ' active' : ''}${partner < 0 ? ' single' : ''}">`);
      parts.push(`<circle cx="${cx}" cy="${y}" r="${R}"/>`);
      parts.push(`<text class="initial" x="${cx}" y="${y + 5}" text-anchor="middle">${esc(names[side][k][0])}</text>`);
      // Centred above the circle, clear of the lines that leave from its inner edge.
      parts.push(`<text class="name" x="${cx}" y="${y - R - 4}" text-anchor="middle">${esc(names[side][k])}</text>`);
      parts.push('</g>');

      const list = prefs[side][k];
      list.forEach((who, pos) => {
        const chipX = side === 'left'
          ? cx - R - 14 - (n - pos) * (CHIP + 2)
          : cx + R + 14 + pos * (CHIP + 2);
        let cls = 'chip';
        if (who === partner) cls += ' partner';
        if (isProposer && pos < asked[k] && who !== partner) cls += ' crossed';
        if (isProposer && current && current.proposer === k && pos === asked[k] - 1) cls += ' asking';
        const strike = cls.includes('crossed')
          ? `<line class="strike" x1="${chipX + 4}" y1="${y + CHIP / 2 - 4}" x2="${chipX + CHIP - 4}" y2="${y - CHIP / 2 + 4}"/>`
          : '';
        parts.push(`<g class="${cls}"><rect x="${chipX}" y="${y - CHIP / 2}" width="${CHIP}" height="${CHIP}" rx="4"/>`
          + `<text x="${chipX + CHIP / 2}" y="${y + 5}" text-anchor="middle">${esc(names[other][who][0])}</text>${strike}</g>`);
      });
    }
  }

  return { height: h, markup: parts.join('') };
}

export function partnerOf(side, k, proposer, holding) {
  if (side === proposer) return holding.indexOf(k);
  return holding[k];
}

// One sentence for each step, read out to screen readers and shown under the board.
// prefs are in left/right terms; the event's indices are in the proposing side's terms.
export function narrate(event, names, proposer, prefs) {
  if (!event) return 'Nobody has proposed yet. Every proposer will ask their first choice.';
  const recvSide = proposer === 'left' ? 'right' : 'left';
  const p = names[proposer][event.proposer];
  const r = names[recvSide][event.receiver];
  const choice = ordinal(prefs[proposer][event.proposer].indexOf(event.receiver) + 1);
  if (event.outcome === 'held') return `${p} proposes to ${r}, their ${choice} choice. ${r} has no offer yet and holds on to ${p}.`;
  const d = names[proposer][event.dropped];
  if (event.outcome === 'swapped') return `${p} proposes to ${r}, their ${choice} choice. ${r} likes ${p} better than ${d}, holds ${p} and lets ${d} go.`;
  const holder = names[proposer][event.holder];
  return `${p} proposes to ${r}, their ${choice} choice. ${r} would rather keep ${holder}, so ${p} must try further down the list.`;
}

export function ordinal(k) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = k % 100;
  return k + (s[(v - 20) % 10] || s[v] || s[0]);
}

// The same lists as a table, for screen readers and for reading them in full.
export function preferenceTable(names, prefs) {
  const n = prefs.left.length;
  const head = Array.from({ length: n }, (_, k) => `<th scope="col">${ordinal(k + 1)}</th>`).join('');
  const body = (side, other) => prefs[side].map((list, i) => `<tr><th scope="row">${esc(names[side][i])}</th>`
    + list.map((who) => `<td>${esc(names[other][who])}</td>`).join('') + '</tr>').join('');
  return `<table><caption>Left side, best first</caption><thead><tr><th scope="col">Person</th>${head}</tr></thead>`
    + `<tbody>${body('left', 'right')}</tbody></table>`
    + `<table><caption>Right side, best first</caption><thead><tr><th scope="col">Person</th>${head}</tr></thead>`
    + `<tbody>${body('right', 'left')}</tbody></table>`;
}
