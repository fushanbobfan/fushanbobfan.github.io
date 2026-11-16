// Plain-language description of two events, for the readout panel.

import {
  boost, interval, separation, properTime, properDistance, simultaneousFrame, colocatedFrame, betaRangeWhereLater,
} from './lorentz.js';

export function fmt(v, digits = 2) {
  const s = Number(v).toFixed(digits);
  return s === `-${(0).toFixed(digits)}` ? (0).toFixed(digits) : s;
}

export function fmtBeta(beta) {
  return `${fmt(beta)}c`;
}

// frames: [{ name, beta }]. Returns per-frame gaps and the frame-free facts.
export function describePair(a, b, frames, names = ['A', 'B']) {
  const [na, nb] = names;
  const kind = separation(a, b);
  const rows = frames.map((f) => {
    const pa = boost(a, f.beta);
    const pb = boost(b, f.beta);
    const dt = pb.t - pa.t;
    const dx = pb.x - pa.x;
    return { name: f.name, beta: f.beta, dt, dx, when: whenWords(dt, na, nb) };
  });
  const s2 = interval(a, b);
  const facts = { kind, s2, sentences: [] };
  const say = (text) => facts.sentences.push(text);

  if (kind === 'timelike') {
    const tau = properTime(a, b);
    const beta = colocatedFrame(a, b);
    facts.properTime = tau;
    facts.colocatedBeta = beta;
    const first = b.t > a.t ? na : nb;
    const second = first === na ? nb : na;
    say(`Timelike: a clock can travel from ${first} to ${second}. Every observer agrees that ${first} comes first.`);
    say(`A clock moving at ${fmtBeta(beta)} relative to the lab is present at both and ticks off ${fmt(tau)} s between them, the longest time any clock can measure from one to the other.`);
  } else if (kind === 'spacelike') {
    const d = properDistance(a, b);
    const beta = simultaneousFrame(a, b);
    facts.properDistance = d;
    facts.simultaneousBeta = beta;
    say(`Spacelike: not even light can get from one to the other, so neither can cause the other.`);
    const later = betaRangeWhereLater(a, b);
    const below = later.from === -1 ? nb : na; // who comes second for observers below the flip speed
    const firstBelow = below === nb ? na : nb;
    say(`An observer moving at ${fmtBeta(beta)} relative to the lab sees them happen at the same moment, ${fmt(d)} light-seconds apart.`);
    say(`Observers moving slower than that (counting leftward speeds as negative) see ${firstBelow} first; faster ones see ${below} first.`);
  } else {
    say(`Lightlike: a flash of light leaving ${b.t >= a.t ? na : nb} arrives exactly at ${b.t >= a.t ? nb : na}. The interval is zero for every observer.`);
  }
  return { rows, facts };
}

function whenWords(dt, na, nb) {
  if (Math.abs(dt) < 5e-3) return 'together';
  return dt > 0 ? `${na} first` : `${nb} first`;
}
