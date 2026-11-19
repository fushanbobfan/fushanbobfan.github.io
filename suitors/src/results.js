import { deferredAcceptance, flip, invert, partnerRanks, allStableMatchings } from './matching.js';
import { ordinal } from './board.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Both extremes: the pairing when the left proposes and when the right proposes, as left -> right.
export function compareProposers(prefs) {
  const byLeft = deferredAcceptance(prefs).match;
  const byRight = invert(deferredAcceptance(flip(prefs)).match);
  const stable = allStableMatchings(prefs);
  const describe = (match) => {
    const ranks = partnerRanks(prefs, match);
    return {
      match,
      ranks,
      leftAverage: mean(ranks.left) + 1,
      rightAverage: mean(ranks.right) + 1,
    };
  };
  return {
    left: describe(byLeft),
    right: describe(byRight),
    stableCount: stable.length,
    same: byLeft.every((r, i) => r === byRight[i]),
  };
}

export function summarize(cmp) {
  if (cmp.same) {
    return 'These lists have exactly one stable pairing, so it makes no difference who proposes.';
  }
  const fmt = (x) => x.toFixed(2);
  return `These lists have ${cmp.stableCount} stable pairings. When the left side proposes, people on the left get, `
    + `on average, choice ${fmt(cmp.left.leftAverage)} on their lists and people on the right choice ${fmt(cmp.left.rightAverage)}. `
    + `When the right side proposes, the left gets ${fmt(cmp.right.leftAverage)} and the right ${fmt(cmp.right.rightAverage)}. `
    + 'Bold marks everyone who does better under one rule than the other: they are all on the proposing side.';
}

function outcomeCard(title, outcome, other, names, current) {
  const rows = outcome.match.map((r, i) => {
    const l = outcome.ranks.left[i];
    const rr = outcome.ranks.right[r];
    const otherL = other.ranks.left[i];
    const otherR = other.ranks.right[r];
    return `<tr><td>${esc(names.left[i])}</td><td>${esc(names.right[r])}</td>`
      + `<td class="num${l < otherL ? ' better' : ''}">${ordinal(l + 1)}</td>`
      + `<td class="num${rr < otherR ? ' better' : ''}">${ordinal(rr + 1)}</td></tr>`;
  }).join('');
  return `<div class="outcome${current ? ' current' : ''}"><h3>${esc(title)}</h3>`
    + '<table><thead><tr><th scope="col">Left</th><th scope="col">Right</th>'
    + '<th scope="col" class="num">Left gets</th><th scope="col" class="num">Right gets</th></tr></thead>'
    + `<tbody>${rows}</tbody></table>`
    + `<p>Average choice: left ${outcome.leftAverage.toFixed(2)}, right ${outcome.rightAverage.toFixed(2)}.</p></div>`;
}

export function renderComparison(cmp, names, proposer) {
  return outcomeCard('When the left side proposes', cmp.left, cmp.right, names, proposer === 'left')
    + outcomeCard('When the right side proposes', cmp.right, cmp.left, names, proposer === 'right');
}
