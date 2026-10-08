import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  binPmf,
  binomialPmf,
  chiSquareSurvival,
  chiSquareTest,
  countSummary,
  expectedTotalVariation,
  gammaQ,
  normalBins,
  normalCdf,
  normalPdf,
  pmfMoments,
  totalVariation,
} from '../src/stats.js';
import { dropMany } from '../src/board.js';
import { mulberry32 } from '../src/rng.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('the binomial matches its closed form', () => {
  const pmf = binomialPmf(10, 0.3);
  let choose = 1;
  for (let k = 0; k <= 10; k++) {
    close(pmf[k], choose * 0.3 ** k * 0.7 ** (10 - k), 1e-14);
    choose = (choose * (10 - k)) / (k + 1);
  }
  close(pmf.reduce((a, b) => a + b, 0), 1, 1e-14);
});

test('binomial moments are np and np(1-p)', () => {
  const m = pmfMoments(binomialPmf(24, 0.35));
  close(m.mean, 24 * 0.35, 1e-12);
  close(m.variance, 24 * 0.35 * 0.65, 1e-12);
});

test('a per-row bias gives the Poisson binomial', () => {
  const bias = [0.1, 0.9, 0.5];
  const pmf = binPmf(3, bias);
  close(pmf[0], 0.9 * 0.1 * 0.5);
  close(pmf[3], 0.1 * 0.9 * 0.5);
  const m = pmfMoments(pmf);
  close(m.mean, 1.5);
  close(m.variance, 0.09 + 0.09 + 0.25);
});

test('the normal density and distribution agree with known values', () => {
  close(normalPdf(0, 0, 1), 1 / Math.sqrt(2 * Math.PI), 1e-15);
  close(normalCdf(0, 0, 1), 0.5, 1e-7);
  close(normalCdf(1.959964, 0, 1), 0.975, 1e-6);
  close(normalCdf(-1, 3, 4), 0.158655, 1e-6);
});

test('continuity-corrected normal bins sit close to the binomial for a big board', () => {
  const pmf = binomialPmf(40, 0.5);
  const { mean, sd } = pmfMoments(pmf);
  const approx = normalBins(41, mean, sd);
  for (let k = 0; k <= 40; k++) close(approx[k], pmf[k], 2e-3);
});

test('the chi-square survival function matches table values', () => {
  close(chiSquareSurvival(3.841459, 1), 0.05, 1e-6);
  close(chiSquareSurvival(18.307038, 10), 0.05, 1e-6);
  close(chiSquareSurvival(2, 2), Math.exp(-1), 1e-12);
  close(chiSquareSurvival(100, 3), 1.6e-21, 1e-21);
  close(gammaQ(1, 0), 1);
});

test('a sample summary gives the mean and unbiased variance', () => {
  const s = countSummary([1, 2, 1]);
  assert.equal(s.total, 4);
  close(s.mean, 1);
  close(s.variance, 2 / 3);
  assert.ok(Number.isNaN(countSummary([0, 0]).mean));
});

test('total variation is zero for a perfect match and one for disjoint support', () => {
  close(totalVariation([25, 50, 25], [0.25, 0.5, 0.25]), 0);
  close(totalVariation([10, 0, 0], [0, 0, 1]), 1);
});

test('the chi-square test pools thin tails and accepts honest drops', () => {
  const pmf = binomialPmf(12, 0.5);
  const counts = dropMany(new Array(13).fill(0), 12, 0.5, mulberry32(9), 2000);
  const res = chiSquareTest(counts, pmf);
  assert.ok(res.groups < 13, 'tails pooled');
  assert.ok(res.pValue > 0.001, `p = ${res.pValue}`);
});

test('the chi-square test rejects drops from the wrong bias', () => {
  const pmf = binomialPmf(12, 0.5);
  const counts = dropMany(new Array(13).fill(0), 12, 0.6, mulberry32(9), 2000);
  assert.ok(chiSquareTest(counts, pmf).pValue < 1e-6);
});

test('p-values from honest boards are roughly uniform', () => {
  const pmf = binomialPmf(10, 0.5);
  const rng = mulberry32(123);
  let below = 0;
  const trials = 400;
  for (let i = 0; i < trials; i++) {
    const counts = dropMany(new Array(11).fill(0), 10, 0.5, rng, 300);
    if (chiSquareTest(counts, pmf).pValue < 0.1) below++;
  }
  assert.ok(below > trials * 0.05 && below < trials * 0.16, `${below} of ${trials} below 0.1`);
});

test('the expected distance falls like one over the square root of the balls', () => {
  const pmf = binomialPmf(12, 0.5);
  const a = expectedTotalVariation(pmf, 100);
  const b = expectedTotalVariation(pmf, 10000);
  close(a / b, 10, 1e-12);
  assert.ok(Number.isNaN(expectedTotalVariation(pmf, 0)));
});

test('the expected distance matches the average over many simulated runs', () => {
  const pmf = binomialPmf(12, 0.5);
  const rng = mulberry32(77);
  const runs = 300;
  const balls = 2000;
  let sum = 0;
  for (let i = 0; i < runs; i++) sum += totalVariation(dropMany(new Array(13).fill(0), 12, 0.5, rng, balls), pmf);
  const simulated = sum / runs;
  const predicted = expectedTotalVariation(pmf, balls);
  assert.ok(Math.abs(simulated - predicted) / predicted < 0.06, `${simulated} vs ${predicted}`);
});
