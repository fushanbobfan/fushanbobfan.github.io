// Pairing people by hand: hand[i] is the right partner of left i, or -1.
import { blockingPairs, partnerRanks, allStableMatchings } from './matching.js';

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function emptyHand(n) {
  return new Array(n).fill(-1);
}

// Pair left l with right r, splitting up whoever either was with. Pairing a couple again splits them.
export function setPair(hand, l, r) {
  const out = hand.slice();
  if (out[l] === r) { out[l] = -1; return out; }
  const prev = out.indexOf(r);
  if (prev >= 0) out[prev] = -1;
  out[l] = r;
  return out;
}

export function isComplete(hand) {
  return hand.every((r) => r >= 0);
}

const list = (items) => (items.length <= 1 ? items.join('')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// A verdict on a hand-made pairing, with the first few blocking pairs spelled out.
// Until everyone is paired, only pairs of two people who already have partners count, so the
// verdict does not fill up with everyone who would take an unpaired person.
export function handVerdict(prefs, hand, names, shown = 3) {
  const n = hand.length;
  const paired = hand.filter((r) => r >= 0).length;
  const rightPaired = new Set(hand.filter((r) => r >= 0));
  const pairs = blockingPairs(prefs, hand)
    .filter(([l, r]) => isComplete(hand) || (hand[l] >= 0 && rightPaired.has(r)));
  if (paired === 0) {
    return { pairs, text: 'Pick someone on the left, then someone on the right, to pair them. Pick a pair again to split it.' };
  }
  if (!pairs.length) {
    return {
      pairs,
      text: isComplete(hand)
        ? 'Stable: no two people would both rather be with each other than with the partners they have.'
        : `No blocking pairs among the people paired so far; ${n - paired} still to pair on each side.`,
    };
  }
  const partnerOfRight = new Array(n).fill(-1);
  hand.forEach((r, i) => { if (r >= 0) partnerOfRight[r] = i; });
  const why = pairs.slice(0, shown).map(([l, r]) => {
    const a = names.left[l];
    const b = names.right[r];
    return `${a} and ${b} (${a} has ${names.right[hand[l]]}, ${b} has ${names.left[partnerOfRight[r]]})`;
  });
  const named = pairs.length > shown ? `${why.join(', ')} and ${pairs.length - shown} more` : list(why);
  const noun = pairs.length === 1 ? 'pair would' : 'pairs would';
  return { pairs, text: `${pairs.length} blocking ${noun} rather be together: ${named}.` };
}

// Every stable pairing with each side's average place for their partner (1 = first choice).
export function stableTable(prefs) {
  return allStableMatchings(prefs).map((match) => {
    const ranks = partnerRanks(prefs, match);
    return { match, leftAverage: mean(ranks.left) + 1, rightAverage: mean(ranks.right) + 1 };
  });
}
