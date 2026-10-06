// Drawing tiles on a 2D canvas and writing them out as SVG.

import { toScreen } from './view.js';
import { tileFill } from './palettes.js';

export function lineWidth(view, edge, weight) {
  // Thin enough to keep small tiles readable, never below a hairline.
  return Math.max(0.35, Math.min(3, edge * view.scale * 0.04 * weight));
}

export function drawTiling(ctx, { tiles, halves = [] }, view, opts) {
  const { palette, colouring = 'kind', edge = 1, weight = 1, turn = 0 } = opts;
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth(view, edge, weight);
  ctx.strokeStyle = palette.line;
  const trace = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = toScreen(view, p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };
  for (const tile of tiles) {
    trace(tile.points);
    ctx.fillStyle = tileFill(tile, colouring, palette, turn);
    ctx.fill();
    if (weight > 0) ctx.stroke();
  }
  for (const half of halves) {
    trace([half.a, half.b, half.c]);
    ctx.fillStyle = tileFill({ kind: half.kind, axis: 0 }, colouring === 'direction' ? 'kind' : colouring, palette);
    ctx.fill();
    if (weight > 0) ctx.stroke();
  }
}

const fmt = (x) => (Math.round(x * 100) / 100).toString();

export function svgDocument({ tiles, halves = [] }, view, opts) {
  const { palette, colouring = 'kind', edge = 1, weight = 1, turn = 0, title = 'Penrose tiling' } = opts;
  const w = view.width;
  const h = view.height;
  const path = (pts) =>
    pts
      .map((p, i) => {
        const [x, y] = toScreen(view, p);
        return `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`;
      })
      .join('') + 'Z';
  // Group tiles by fill so the file stays small.
  const groups = new Map();
  const add = (fill, d) => {
    if (!groups.has(fill)) groups.set(fill, []);
    groups.get(fill).push(d);
  };
  for (const t of tiles) add(tileFill(t, colouring, palette, turn), path(t.points));
  for (const s of halves) {
    add(tileFill({ kind: s.kind, axis: 0 }, colouring === 'direction' ? 'kind' : colouring, palette), path([s.a, s.b, s.c]));
  }
  const stroke =
    weight > 0
      ? ` stroke="${palette.line}" stroke-width="${fmt(lineWidth(view, edge, weight))}" stroke-linejoin="round"`
      : '';
  const body = [...groups.entries()]
    .map(([fill, ds]) => `  <path fill="${fill}"${stroke} d="${ds.join('')}"/>`)
    .join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  <title>${title}</title>`,
    `  <rect width="${w}" height="${h}" fill="${palette.background}"/>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}
