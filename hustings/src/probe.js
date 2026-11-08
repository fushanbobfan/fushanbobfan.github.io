import { castBallots } from './voters.js';
import { METHODS, pairwise, condorcetWinner, firstChoices } from './methods.js';
import { COLORS, LETTERS } from './scenes.js';

const chip = (c) => `<span class="swatch" style="background:${COLORS[c]}"></span>${LETTERS[c]}`;

function bars(values, total, unit) {
  const max = Math.max(...values, 1);
  return `<div class="bars">${values.map((v, c) => `
    <span>${chip(c)}</span>
    <span class="bar" style="width:${(100 * v) / max}%;background:${COLORS[c]}"></span>
    <span>${v} ${unit}${total ? ` (${Math.round((100 * v) / total)}%)` : ''}</span>`).join('')}</div>`;
}

const detail = {
  plurality(r, b) {
    return `<p>First choices of ${b.n} voters.</p>${bars(r.tally, b.n, 'votes')}`;
  },
  runoff(r, b) {
    if (!r.finalists) {
      return `<p>${chip(r.winner)} has a majority of first choices, so there is no second round.</p>${bars(r.first, b.n, 'votes')}`;
    }
    const [f1, f2] = r.finalists;
    return `<p>Round one: nobody has a majority, so ${chip(f1)} and ${chip(f2)} go through.</p>
      ${bars(r.first, b.n, 'votes')}
      <p style="margin-top:12px">Round two: each voter backs whichever finalist they rank higher.</p>
      ${bars(r.second, b.n, 'votes')}`;
  },
  irv(r, b) {
    const k = b.k;
    const head = r.rounds.map((_, i) => `<th>Round ${i + 1}</th>`).join('');
    const rows = Array.from({ length: k }, (_, c) => {
      let out = false;
      const cells = r.rounds.map((round) => {
        const cell = out ? '<td class="out">—</td>'
          : `<td class="${round.eliminated === c ? 'out' : (round.eliminated < 0 && c === r.winner ? 'win' : '')}">${round.tally[c]}</td>`;
        if (round.eliminated === c) out = true;
        return cell;
      }).join('');
      return `<tr><td>${chip(c)}</td>${cells}</tr>`;
    }).join('');
    return `<p>Each round counts every ballot for its highest-ranked candidate still standing. The struck-through candidate has the fewest and drops out.</p>
      <table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  },
  borda(r, b) {
    return `<p>Points from ${b.n} rankings of ${b.k} candidates (${b.k - 1} for a first choice down to 0 for a last).</p>${bars(r.score, 0, 'points')}`;
  },
  approval(r, b) {
    return `<p>Approvals from ${b.n} voters, each approving the candidates nearer than their average distance.</p>${bars(r.score, b.n, 'approvals')}`;
  },
  minimax(r, b) {
    const k = b.k;
    const head = Array.from({ length: k }, (_, c) => `<th>${chip(c)}</th>`).join('');
    const rows = Array.from({ length: k }, (_, a) => {
      const cells = Array.from({ length: k }, (_, c) => {
        if (a === c) return '<td>—</td>';
        const v = r.pair[a * k + c];
        return `<td class="${v > r.pair[c * k + a] ? 'win' : ''}">${v}</td>`;
      }).join('');
      return `<tr><td>${chip(a)} over</td>${cells}</tr>`;
    }).join('');
    const verdict = r.condorcet >= 0
      ? `${chip(r.condorcet)} beats every rival head to head: the Condorcet winner.`
      : `Nobody beats every rival: the head-to-head results go round in a cycle. ${chip(r.winner)} has the smallest worst defeat (${r.worst[r.winner]} votes against).`;
    return `<p>How many voters rank each row's candidate above each column's. Bold marks a head-to-head win.</p>
      <table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:10px">${verdict}</p>`;
  },
};

export function electionAt({ point, candidates, spread, cloud }) {
  const ballots = castBallots(cloud, point.x, point.y, spread, candidates);
  const results = METHODS.map((m) => m.count(ballots));
  const cw = condorcetWinner(pairwise(ballots), candidates.length);
  return { ballots, results, condorcet: cw, first: firstChoices(ballots) };
}

export function renderProbe(el, { point, candidates, spread, cloud, method, onSelect }) {
  const { ballots, results, condorcet } = electionAt({ point, candidates, spread, cloud });
  const verdicts = METHODS.map((m, i) =>
    `<button type="button" data-method="${i}" aria-pressed="${i === method}">${m.name}: ${chip(results[i].winner)}</button>`).join('');
  const where = `${Math.round(point.x * 100)}% across, ${Math.round(point.y * 100)}% down`;
  const cwText = condorcet >= 0 ? `The Condorcet winner here is ${chip(condorcet)}.` : 'There is no Condorcet winner here.';
  el.innerHTML = `<p>An electorate of ${ballots.n} voters centred ${where}. ${cwText}</p>
    <div class="verdicts">${verdicts}</div>
    <h3 style="font-size:1.05rem;margin:16px 0 6px">${METHODS[method].name}</h3>
    ${detail[METHODS[method].id](results[method], ballots)}`;
  el.querySelectorAll('button[data-method]').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(Number(btn.dataset.method)));
  });
}
