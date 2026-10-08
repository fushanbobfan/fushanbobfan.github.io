import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barScale, drawScene, landingY, normalCurvePoints } from '../src/render.js';
import { binCentre, layout } from '../src/board.js';
import { binomialPmf, pmfMoments } from '../src/stats.js';

function stubContext() {
  const calls = {};
  return new Proxy(
    { calls },
    {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          calls[key] = (calls[key] || 0) + 1;
          return args;
        };
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
}

const colours = { bg: '#fff', peg: '#000', wall: '#888', bar: '#ccc', exact: '#00f', normal: '#f00', ball: '#333' };

test('bars never overflow the bins and grow no taller than stacked balls', () => {
  const L = layout(10, 600, 500);
  const pmf = binomialPmf(10, 0.5);
  const counts = [0, 0, 0, 5000, 0, 0, 0, 0, 0, 0, 0];
  const scale = barScale(L, counts, pmf);
  assert.ok(5000 * scale <= L.binBottom - L.binTop);
  assert.ok(barScale(L, new Array(11).fill(0), pmf) <= L.ballRadius * 2);
});

test('a falling ball lands on top of its bin', () => {
  const L = layout(6, 600, 500);
  const counts = [0, 3, 0, 0, 0, 0, 0];
  assert.equal(landingY(L, counts, 1, 4), L.binBottom - 12 - L.ballRadius);
  assert.equal(landingY(L, counts, 0, 4), L.binBottom - L.ballRadius);
});

test('the normal curve peaks over the middle bin at the expected height', () => {
  const L = layout(20, 800, 600);
  const pmf = binomialPmf(20, 0.5);
  const { mean, sd } = pmfMoments(pmf);
  const pts = normalCurvePoints(L, mean, sd, 1000, 0.1, 400);
  const top = pts.reduce((best, p) => (p[1] < best[1] ? p : best));
  assert.ok(Math.abs(top[0] - binCentre(L, 10)) < L.dx * 0.05);
  const peakCount = (L.binBottom - top[1]) / 0.1;
  assert.ok(Math.abs(peakCount - pmf[10] * 1000) < 6, `${peakCount} vs ${pmf[10] * 1000}`);
});

test('a whole scene draws without touching anything but the context', () => {
  const L = layout(8, 500, 400);
  const pmf = binomialPmf(8, 0.5);
  const ctx = stubContext();
  const balls = [{ path: Uint8Array.from([1, 0, 1, 0, 1, 0, 1, 0]), t: 4.5, bin: 4 }];
  const scale = drawScene(
    ctx,
    L,
    { counts: [1, 2, 3, 4, 5, 4, 3, 2, 1], pmf, balls, showExact: true, showNormal: true, mean: 4, sd: Math.SQRT2 },
    colours,
  );
  assert.ok(scale > 0);
  assert.equal(ctx.calls.fillRect, 1 + 9);
  assert.ok(ctx.calls.arc >= 36 + 1);
});
