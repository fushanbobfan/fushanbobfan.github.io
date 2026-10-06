// Drawing tiles on a 2D canvas and writing them out as SVG.

import { toScreen } from './view.js';
import { tileFill } from './palettes.js';

// Lines thin out with the tiles and vanish once tiles are only a few
// pixels across, where outlines would bury the colours.
export function lineWidth(view, edge, weight) {
  const w = edge * view.scale * 0.04 * weight;
  return w < 0.15 ? 0 : Math.min(3, w);
}

// Tiles are batched by fill. Very long paths are slow to fill and stroke,
// so each batch is drawn in runs of a modest number of tiles.
function groupByFill({ tiles, halves = [] }, colouring, palette, turn) {
  const groups = new Map();
  const add = (fill, pts) => {
    if (!groups.has(fill)) groups.set(fill, []);
    groups.get(fill).push(pts);
  };
  for (const t of tiles) add(tileFill(t, colouring, palette, turn), t.points);
  const halfColouring = colouring === 'direction' ? 'kind' : colouring;
  for (const h of halves) add(tileFill({ kind: h.kind, axis: 0 }, halfColouring, palette), [h.a, h.b, h.c]);
  return groups;
}

export function drawTiling(ctx, patch, view, opts) {
  const { palette, colouring = 'kind', edge = 1, weight = 1, turn = 0 } = opts;
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.lineJoin = 'bevel';
  const width = lineWidth(view, edge, weight);
  ctx.lineWidth = width || 1;
  ctx.strokeStyle = palette.line;
  const { cx, cy, scale } = view;
  for (const [fill, polygons] of groupByFill(patch, colouring, palette, turn)) {
    ctx.fillStyle = fill;
    for (let start = 0; start < polygons.length; start += RUN) {
      ctx.beginPath();
      const end = Math.min(polygons.length, start + RUN);
      for (let j = start; j < end; j++) {
        const pts = polygons[j];
        ctx.moveTo(cx + scale * pts[0][0], cy - scale * pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(cx + scale * pts[i][0], cy - scale * pts[i][1]);
        ctx.closePath();
      }
      ctx.fill();
      if (width > 0) ctx.stroke();
    }
  }
}

export const RUN = 128;

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
  const groups = new Map(
    [...groupByFill({ tiles, halves }, colouring, palette, turn)].map(([fill, polys]) => [fill, polys.map(path)]),
  );
  const width = lineWidth(view, edge, weight);
  const stroke =
    width > 0
      ? ` stroke="${palette.line}" stroke-width="${fmt(width)}" stroke-linejoin="bevel"`
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
