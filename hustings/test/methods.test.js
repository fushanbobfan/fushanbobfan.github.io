import test from 'node:test';
import assert from 'node:assert/strict';
import { ballotsFromRankings } from '../src/voters.js';
import {
  plurality, runoff, instantRunoff, borda, approval, minimax,
  pairwise, condorcetWinner, METHODS, cardinalScores, score, star,
} from '../src/methods.js';

const A = 0, B = 1, C = 2, D = 3;

// The centre squeeze: the moderate B beats both rivals head to head,
// but has the fewest first choices.
const squeeze = ballotsFromRankings([
  [35, [A, B, C]],
  [33, [C, B, A]],
  [16, [B, A, C]],
  [16, [B, C, A]],
]);

test('centre squeeze: plurality and instant runoff pass over the Condorcet winner', () => {
  assert.equal(plurality(squeeze).winner, A);
  const irv = instantRunoff(squeeze);
  assert.equal(irv.winner, A);
  assert.equal(irv.rounds[0].eliminated, B);
  assert.deepEqual(irv.rounds[1].tally, [51, 0, 49]);
  assert.equal(minimax(squeeze).winner, B);
  assert.equal(minimax(squeeze).condorcet, B);
  assert.deepEqual(borda(squeeze).score, [86, 132, 82]);
  assert.equal(borda(squeeze).winner, B);
});

test('a runoff overturns a plurality leader without a majority', () => {
  const b = ballotsFromRankings([[40, [A, B, C]], [35, [B, C, A]], [25, [C, B, A]]]);
  assert.equal(plurality(b).winner, A);
  const r = runoff(b);
  assert.deepEqual(r.finalists, [A, B]);
  assert.deepEqual(r.second, [40, 60, 0]);
  assert.equal(r.winner, B);
});

test('a first-round majority ends the runoff at once', () => {
  const b = ballotsFromRankings([[51, [A, B, C]], [49, [B, C, A]]]);
  const r = runoff(b);
  assert.equal(r.winner, A);
  assert.equal(r.finalists, null);
});

test('instant runoff and the two-round runoff can differ with four candidates', () => {
  // First choices A 30, B 26, C 24, D 20. The runoff keeps A and B, and B wins it.
  // Instant runoff drops D, whose votes lift C past B; then B drops and C wins.
  const b = ballotsFromRankings([
    [30, [A, B, C, D]],
    [26, [B, C, A, D]],
    [24, [C, B, A, D]],
    [20, [D, C, B, A]],
  ]);
  assert.equal(runoff(b).winner, B);
  const irv = instantRunoff(b);
  assert.deepEqual(irv.rounds.map((r) => r.eliminated), [D, B, -1]);
  assert.equal(irv.winner, C);
});

test('a Condorcet cycle has no Condorcet winner, and minimax takes the mildest defeat', () => {
  const b = ballotsFromRankings([[40, [A, B, C]], [35, [B, C, A]], [25, [C, A, B]]]);
  const pair = pairwise(b);
  assert.equal(pair[A * 3 + B], 65);
  assert.equal(pair[B * 3 + C], 75);
  assert.equal(pair[C * 3 + A], 60);
  assert.equal(condorcetWinner(pair, 3), -1);
  const m = minimax(b);
  assert.deepEqual(m.worst, [60, 65, 75]);
  assert.equal(m.winner, A);
});

test('approval counts candidates nearer than the voter\'s average', () => {
  // Hand-written ballots put candidates at distances 0, 1, 2 (average 1),
  // so each voter approves only the first choice.
  const b = ballotsFromRankings([[3, [A, B, C]], [2, [B, C, A]]]);
  assert.deepEqual(approval(b).score, [3, 2, 0]);
  const four = ballotsFromRankings([[3, [A, B, C, D]], [4, [D, C, B, A]]]);
  // Average 1.5: first and second choices are approved.
  assert.deepEqual(approval(four).score, [3, 3, 4, 4]);
  assert.equal(approval(four).winner, C);
});

test('exact ties go to the lower-numbered candidate', () => {
  const b = ballotsFromRankings([[5, [B, A, C]], [5, [A, B, C]]]);
  assert.equal(plurality(b).winner, A);
  assert.equal(borda(b).winner, A);
  assert.equal(runoff(b).winner, A);
  assert.equal(instantRunoff(b).winner, A);
});

test('every rule elects the only candidate in a one-horse race', () => {
  const b = ballotsFromRankings([[3, [A]]]);
  for (const m of METHODS) assert.equal(m.count(b).winner, A, m.id);
});

test('every rule elects a candidate who is everyone\'s first choice', () => {
  const b = ballotsFromRankings([[6, [C, A, B]], [4, [C, B, A]]]);
  for (const m of METHODS) assert.equal(m.count(b).winner, C, m.id);
});

function ballotsFromDistances(groups) {
  const k = groups[0][1].length;
  const n = groups.reduce((s, [count]) => s + count, 0);
  const order = new Uint8Array(n * k);
  const dist = new Float64Array(n * k);
  let v = 0;
  for (const [count, ds] of groups) {
    const rank = [...ds.keys()].sort((a, b) => ds[a] - ds[b] || a - b);
    for (let i = 0; i < count; i++, v++) {
      ds.forEach((d, c) => { dist[v * k + c] = d; });
      rank.forEach((c, r) => { order[v * k + r] = c; });
    }
  }
  return { n, k, order, dist };
}

test('score ballots run from 5 for the nearest to 0 for the farthest', () => {
  const b = ballotsFromDistances([[1, [0.1, 0.5, 0.3]], [1, [0.2, 0.2, 0.2]]]);
  const { each, total } = cardinalScores(b);
  assert.deepEqual([...each], [5, 0, 3, 5, 5, 5]);
  assert.deepEqual(total, [10, 5, 8]);
});

test('STAR\'s runoff can overturn the highest score', () => {
  // Four voters love A and score B 0; five prefer B but still give A a 4.
  const b = ballotsFromDistances([[4, [0, 1, 1]], [5, [0.2, 0, 1]]]);
  const s = score(b);
  assert.deepEqual(s.score, [40, 25, 0]);
  assert.equal(s.winner, A);
  const r = star(b);
  assert.deepEqual(r.finalists, [A, B]);
  assert.deepEqual(r.prefer, [4, 5, 0]);
  assert.equal(r.winner, B);
});

test('an even STAR runoff goes to the higher total', () => {
  const b = ballotsFromDistances([[2, [0, 1, 1]], [2, [0.4, 0, 1]]]);
  const r = star(b);
  assert.deepEqual(r.score, [16, 10, 0]);
  assert.deepEqual(r.prefer, [2, 2, 0]);
  assert.equal(r.winner, A);
});
