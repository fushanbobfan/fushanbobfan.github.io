// The distributions a board should produce, and how far a run of drops
// is from them.

// Exact chance of each bin. With one bias for every row this is the
// binomial distribution; with a bias per row it is the Poisson binomial,
// built one row at a time by convolution.
export function binPmf(rows, bias) {
  let pmf = [1];
  for (let r = 0; r < rows; r++) {
    const p = Array.isArray(bias) ? bias[r] : bias;
    const next = new Array(pmf.length + 1).fill(0);
    for (let k = 0; k < pmf.length; k++) {
      next[k] += pmf[k] * (1 - p);
      next[k + 1] += pmf[k] * p;
    }
    pmf = next;
  }
  return pmf;
}

export function binomialPmf(n, p) {
  return binPmf(n, p);
}

export function pmfMoments(pmf) {
  let mean = 0;
  let second = 0;
  for (let k = 0; k < pmf.length; k++) {
    mean += k * pmf[k];
    second += k * k * pmf[k];
  }
  const variance = Math.max(0, second - mean * mean);
  return { mean, variance, sd: Math.sqrt(variance) };
}

export function normalPdf(x, mean, sd) {
  if (sd <= 0) return x === mean ? Infinity : 0;
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

// Abramowitz and Stegun 7.1.26, good to about 1.5e-7.
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(x, mean, sd) {
  if (sd <= 0) return x < mean ? 0 : 1;
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
}

// Normal approximation to each bin, with the usual continuity correction:
// bin k gets the area between k - 1/2 and k + 1/2.
export function normalBins(bins, mean, sd) {
  const out = new Array(bins);
  for (let k = 0; k < bins; k++) {
    out[k] = normalCdf(k + 0.5, mean, sd) - normalCdf(k - 0.5, mean, sd);
  }
  return out;
}

export function countSummary(counts) {
  let total = 0;
  let sum = 0;
  let sumSq = 0;
  for (let k = 0; k < counts.length; k++) {
    total += counts[k];
    sum += k * counts[k];
    sumSq += k * k * counts[k];
  }
  if (total === 0) return { total, mean: NaN, variance: NaN, sd: NaN };
  const mean = sum / total;
  const variance = total > 1 ? (sumSq - total * mean * mean) / (total - 1) : 0;
  return { total, mean, variance: Math.max(0, variance), sd: Math.sqrt(Math.max(0, variance)) };
}

// Half the summed gap between the observed shares and the exact chances:
// 0 for a perfect match, 1 for no overlap at all.
export function totalVariation(counts, pmf) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return NaN;
  let tv = 0;
  for (let k = 0; k < pmf.length; k++) tv += Math.abs((counts[k] || 0) / total - pmf[k]);
  return tv / 2;
}

// What the total variation distance should be on average after `total`
// balls. Each bin's share has spread sqrt(p(1 - p) / N), and the mean
// absolute value of a normal with that spread is sqrt(2 / pi) times it,
// so the expected distance falls like 1 / sqrt(N). The approximation is
// close once most bins expect a few balls.
export function expectedTotalVariation(pmf, total) {
  if (!(total > 0)) return NaN;
  let sum = 0;
  for (const q of pmf) sum += Math.sqrt(q * (1 - q));
  return 0.5 * Math.sqrt(2 / (Math.PI * total)) * sum;
}

function logGamma(x) {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += g[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Upper regularised incomplete gamma Q(a, x), by series below a + 1 and
// a continued fraction above it.
export function gammaQ(a, x) {
  if (x <= 0) return 1;
  const lead = -x + a * Math.log(x) - logGamma(a);
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return Math.max(0, 1 - sum * Math.exp(lead));
  }
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.min(1, Math.exp(lead) * h);
}

export function chiSquareSurvival(stat, df) {
  return gammaQ(df / 2, stat / 2);
}

// Pearson's goodness-of-fit test against the exact bin chances. Bins with
// fewer than five expected balls are pooled with their neighbours (from
// each tail inwards) so the chi-square approximation holds.
export function chiSquareTest(counts, pmf, minExpected = 5) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const groups = [];
  let obs = 0;
  let exp = 0;
  for (let k = 0; k < pmf.length; k++) {
    obs += counts[k] || 0;
    exp += pmf[k] * total;
    if (exp >= minExpected) {
      groups.push([obs, exp]);
      obs = 0;
      exp = 0;
    }
  }
  if (exp > 0 || obs > 0) {
    if (groups.length === 0) groups.push([obs, exp]);
    else {
      groups[groups.length - 1][0] += obs;
      groups[groups.length - 1][1] += exp;
    }
  }
  if (groups.length < 2) return { stat: 0, df: 0, pValue: NaN, groups: groups.length };
  let stat = 0;
  for (const [o, e] of groups) stat += ((o - e) * (o - e)) / e;
  const df = groups.length - 1;
  return { stat, df, pValue: chiSquareSurvival(stat, df), groups: groups.length };
}
