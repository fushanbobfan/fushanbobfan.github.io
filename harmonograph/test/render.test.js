import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, colorAt, isDark, colorRuns, drawRange, toSvg } from '../src/render.js';
import { fitTransform } from '../src/harmonograph.js';

function mockContext() {
  const calls = [];
  return {
    calls,
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    set globalAlpha(v) { calls.push(['globalAlpha', v]); },
    set lineJoin(v) {},
    set lineCap(v) {},
    beginPath() { calls.push(['beginPath']); },
    moveTo(x, y) { calls.push(['moveTo', x, y]); },
    lineTo(x, y) { calls.push(['lineTo', x, y]); },
    stroke() { calls.push(['stroke']); },
  };
}

const unitFit = fitTransform({ minX: -1, minY: -1, maxX: 1, maxY: 1 }, 100, 100, 0);

test('isDark separates dark and light paper colours', () => {
  assert.equal(isDark('#0d1220'), true);
  assert.equal(isDark('#f4efe4'), false);
  assert.equal(isDark('not a colour'), false);
});

test('solid palettes use one colour and spectrum palettes sweep hue', () => {
  assert.equal(colorAt(PALETTES.ink, 0.3), PALETTES.ink.color);
  assert.equal(colorAt(PALETTES.spectrum, 0), 'hsl(0.0 80% 42%)');
  assert.equal(colorAt(PALETTES.spectrum, 1), 'hsl(300.0 80% 42%)');
  assert.equal(colorAt(PALETTES.spectrum, 7), 'hsl(300.0 80% 42%)');
  assert.match(colorAt(PALETTES.night, 0.5), /62%\)$/);
});

test('colorRuns covers the range contiguously with one-point overlaps', () => {
  const runs = colorRuns(5, 400, 1000, PALETTES.spectrum, 10);
  assert.equal(runs[0].from, 5);
  assert.equal(runs.at(-1).to, 400);
  for (let i = 1; i < runs.length; i++) assert.equal(runs[i].from, runs[i - 1].to);
  assert.deepEqual(colorRuns(3, 3, 10, PALETTES.ink), []);
  assert.equal(colorRuns(0, 9, 10, PALETTES.ink).length, 1);
});

test('colorRuns gives a point the same colour however the range is split', () => {
  const whole = colorRuns(0, 999, 1000, PALETTES.night);
  const parts = [...colorRuns(0, 333, 1000, PALETTES.night), ...colorRuns(333, 999, 1000, PALETTES.night)];
  const colourOf = (runs, i) => runs.find((r) => i >= r.from && i < r.to).color;
  for (const i of [0, 100, 332, 333, 500, 998]) assert.equal(colourOf(parts, i), colourOf(whole, i));
});

test('drawRange strokes a continuous polyline in screen coordinates', () => {
  const ctx = mockContext();
  const pts = Float64Array.of(-1, -1, 0, 0, 1, 1);
  drawRange(ctx, pts, 0, 10, unitFit, PALETTES.ink, 2);
  const moves = ctx.calls.filter((c) => c[0] === 'moveTo' || c[0] === 'lineTo');
  assert.deepEqual(moves, [['moveTo', 0, 100], ['lineTo', 50, 50], ['lineTo', 100, 0]]);
  assert.deepEqual(ctx.calls[0], ['lineWidth', 2]);
  assert.equal(ctx.calls.filter((c) => c[0] === 'stroke').length, 1);
  assert.deepEqual(ctx.calls[1], ['globalAlpha', PALETTES.ink.alpha]);
  assert.deepEqual(ctx.calls.at(-1), ['globalAlpha', 1]);
});

test('toSvg produces a self-contained document with paper and paths', () => {
  const pts = Float64Array.of(-1, 0, 0, 1, 1, 0);
  const svg = toSvg(pts, unitFit, { width: 100, height: 100, palette: PALETTES.sepia, lineWidth: 1.5 });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="100" height="100"/);
  assert.match(svg, /fill="#f2e6cf"/);
  assert.match(svg, /stroke-width="1.5" stroke-opacity="0.75"/);
  assert.match(svg, /<path d="M0.00 50.00L50.00 0.00L100.00 50.00" stroke="#6b3d1f"\/>/);
  assert.ok(svg.endsWith('</svg>'));
});
