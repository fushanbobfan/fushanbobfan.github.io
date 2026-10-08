// Drawing the board onto a 2D canvas context. Everything here takes the
// context, the layout and plain data, so it can run against a stub in tests.

import { ballPosition, binCentre, pegPosition } from './board.js';
import { normalPdf } from './stats.js';

// Pixels per ball in the bins. The scale is set so the tallest of the
// observed bars and the expected peak fills most of the bin height.
export function barScale(L, counts, pmf) {
  const total = counts.reduce((a, b) => a + b, 0);
  const peak = Math.max(...counts, Math.max(...pmf) * total, 1);
  const room = (L.binBottom - L.binTop) * 0.86;
  return Math.min(room / peak, L.ballRadius * 2);
}

// The height a falling ball should stop at: the top of its bin's bar.
export function landingY(L, counts, bin, scale) {
  return L.binBottom - counts[bin] * scale - L.ballRadius;
}

export function drawBoard(ctx, L, colours) {
  ctx.fillStyle = colours.peg;
  for (let r = 0; r < L.rows; r++) {
    for (let k = 0; k <= r; k++) {
      const { x, y } = pegPosition(L, r, k);
      ctx.beginPath();
      ctx.arc(x, y, L.pegRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = colours.wall;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let j = 0; j <= L.rows + 1; j++) {
    const x = binCentre(L, j) - L.dx / 2;
    ctx.moveTo(x, L.binTop + L.dy * 0.4);
    ctx.lineTo(x, L.binBottom);
  }
  ctx.moveTo(binCentre(L, 0) - L.dx / 2, L.binBottom);
  ctx.lineTo(binCentre(L, L.rows) + L.dx / 2, L.binBottom);
  ctx.stroke();
}

export function drawBars(ctx, L, counts, scale, colours) {
  ctx.fillStyle = colours.bar;
  const w = L.dx * 0.78;
  for (let k = 0; k < counts.length; k++) {
    if (!counts[k]) continue;
    const h = counts[k] * scale;
    ctx.fillRect(binCentre(L, k) - w / 2, L.binBottom - h, w, h);
  }
}

// A short tick across each bin at the exact expected count.
export function drawExpected(ctx, L, pmf, total, scale, colours) {
  if (total === 0) return;
  ctx.strokeStyle = colours.exact;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const half = L.dx * 0.45;
  for (let k = 0; k < pmf.length; k++) {
    const y = L.binBottom - pmf[k] * total * scale;
    ctx.moveTo(binCentre(L, k) - half, y);
    ctx.lineTo(binCentre(L, k) + half, y);
  }
  ctx.stroke();
}

// The normal density with the board's mean and spread, scaled to counts.
export function normalCurvePoints(L, mean, sd, total, scale, steps = 200) {
  const pts = [];
  const x0 = binCentre(L, 0) - L.dx / 2;
  const x1 = binCentre(L, L.rows) + L.dx / 2;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const k = (x - L.cx) / L.dx + L.rows / 2;
    pts.push([x, L.binBottom - normalPdf(k, mean, sd) * total * scale]);
  }
  return pts;
}

export function drawNormal(ctx, L, mean, sd, total, scale, colours) {
  if (total === 0 || !(sd > 0)) return;
  const pts = normalCurvePoints(L, mean, sd, total, scale);
  ctx.strokeStyle = colours.normal;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

export function drawBalls(ctx, L, balls, counts, scale, colours) {
  ctx.fillStyle = colours.ball;
  for (const b of balls) {
    const { x, y } = ballPosition(L, b.path, b.t, landingY(L, counts, b.bin, scale));
    ctx.beginPath();
    ctx.arc(x, y, L.ballRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawScene(ctx, L, scene, colours) {
  const { counts, pmf, balls, showExact, showNormal, mean, sd } = scene;
  const total = counts.reduce((a, b) => a + b, 0);
  const scale = barScale(L, counts, pmf);
  ctx.fillStyle = colours.bg;
  ctx.fillRect(0, 0, L.width, L.height);
  drawBars(ctx, L, counts, scale, colours);
  drawBoard(ctx, L, colours);
  if (showNormal) drawNormal(ctx, L, mean, sd, total, scale, colours);
  if (showExact) drawExpected(ctx, L, pmf, total, scale, colours);
  drawBalls(ctx, L, balls, counts, scale, colours);
  return scale;
}
