import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEEDS, assemble, grow } from '../src/tiling.js';
import { PALETTES } from '../src/palettes.js';
import { fitView } from '../src/view.js';
import { RUN, drawOutlines, drawTiling, lineWidth, outlineWidth, svgDocument } from '../src/render.js';

function patch(id, g) {
  const tris = grow(id, g);
  return assemble(tris, SEEDS[id].system);
}

function recorder() {
  const calls = [];
  const ctx = new Proxy(
    { calls },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return (...args) => calls.push([prop, args]);
      },
      set(target, prop, value) {
        calls.push([`=${String(prop)}`, value]);
        return true;
      },
    },
  );
  return ctx;
}

test('tiles are drawn in short runs per fill, with every tile traced', () => {
  const p = patch('p2-sun', 3);
  const view = fitView(SEEDS['p2-sun'].build(), 400, 300, { fit: 'patch' });
  const ctx = recorder();
  drawTiling(ctx, p, view, { palette: PALETTES.slate });
  const fills = ctx.calls.filter(([n]) => n === 'fill').length;
  const kites = p.tiles.filter((t) => t.kind === 'kite').length + p.halves.filter((h) => h.kind === 'kite').length;
  const darts = p.tiles.length + p.halves.length - kites;
  assert.equal(fills, Math.ceil(kites / RUN) + Math.ceil(darts / RUN));
  assert.equal(ctx.calls.filter(([n]) => n === 'stroke').length, fills);
  const closes = ctx.calls.filter(([n]) => n === 'closePath').length;
  assert.equal(closes, p.tiles.length + p.halves.length);
  const lines = ctx.calls.filter(([n]) => n === 'lineTo').length;
  assert.equal(lines, p.tiles.length * 3 + p.halves.length * 2);
});

test('a zero line weight leaves the edges unstroked', () => {
  const p = patch('p3-sun', 2);
  const view = fitView(SEEDS['p3-sun'].build(), 400, 300, { fit: 'patch' });
  const ctx = recorder();
  drawTiling(ctx, p, view, { palette: PALETTES.ink, weight: 0 });
  assert.equal(ctx.calls.filter(([n]) => n === 'stroke').length, 0);
});

test('SVG export holds every tile, grouped by fill', () => {
  const p = patch('p3-star', 3);
  const view = fitView(SEEDS['p3-star'].build(), 500, 500, { fit: 'patch' });
  const svg = svgDocument(p, view, { palette: PALETTES.garden, colouring: 'kind' });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="500" height="500"/);
  assert.equal((svg.match(/<path /g) || []).length, 2);
  assert.equal((svg.match(/Z/g) || []).length, p.tiles.length + p.halves.length);
  assert.ok(svg.includes(PALETTES.garden.tiles.thick));
  assert.ok(svg.trim().endsWith('</svg>'));
});

test('direction colouring uses up to ten fills', () => {
  const p = patch('p2-sun', 5);
  const view = fitView(SEEDS['p2-sun'].build(), 500, 500);
  const svg = svgDocument({ tiles: p.tiles }, view, { palette: PALETTES.terracotta, colouring: 'direction', turn: 18 });
  const groups = (svg.match(/<path /g) || []).length;
  assert.ok(groups > 2 && groups <= 10);
});

test('line width scales with the tile size within limits', () => {
  const view = { scale: 1000 };
  assert.equal(lineWidth(view, 1, 1), 3);
  assert.equal(lineWidth(view, 0.001, 1), 0);
  assert.equal(lineWidth(view, 0.05, 0), 0);
  assert.ok(lineWidth(view, 0.05, 1) > 0.15 && lineWidth(view, 0.05, 1) < 3);
});

test('tiles too small for outlines are drawn without strokes', () => {
  const p = patch('p2-sun', 6);
  const view = fitView(SEEDS['p2-sun'].build(), 60, 60, { fit: 'patch' });
  const ctx = recorder();
  drawTiling(ctx, p, view, { palette: PALETTES.slate, edge: Math.pow(1.618034, -6) });
  assert.equal(ctx.calls.filter(([n]) => n === 'stroke').length, 0);
  assert.ok(!svgDocument(p, view, { palette: PALETTES.slate, edge: Math.pow(1.618034, -6) }).includes('stroke='));
});

test('larger tiles are outlined without fills, in runs', () => {
  const coarse = patch('p3-sun', 2);
  const view = fitView(SEEDS['p3-sun'].build(), 400, 400, { fit: 'patch' });
  const ctx = recorder();
  const polys = coarse.tiles.map((t) => t.points);
  drawOutlines(ctx, polys, view, '#ff0000', 2);
  assert.equal(ctx.calls.filter(([n]) => n === 'fill').length, 0);
  assert.equal(ctx.calls.filter(([n]) => n === 'stroke').length, Math.ceil(polys.length / RUN));
  assert.equal(ctx.calls.filter(([n]) => n === 'closePath').length, polys.length);
  assert.ok(ctx.calls.some(([n, v]) => n === '=strokeStyle' && v === '#ff0000'));
  const quiet = recorder();
  drawOutlines(quiet, [], view, '#ff0000', 2);
  assert.equal(quiet.calls.length, 0);
});

test('SVG export adds the outlines as one unfilled path on top', () => {
  const fine = patch('p2-sun', 4);
  const coarse = patch('p2-sun', 2);
  const view = fitView(SEEDS['p2-sun'].build(), 300, 300, { fit: 'patch' });
  const svg = svgDocument(fine, view, {
    palette: PALETTES.slate,
    overlay: { polygons: coarse.tiles.map((t) => t.points), width: 2 },
  });
  const paths = svg.match(/<path [^>]*>/g);
  assert.match(paths.at(-1), new RegExp(`fill="none" stroke="${PALETTES.slate.overlay}"`));
  assert.equal((paths.at(-1).match(/Z/g) || []).length, coarse.tiles.length);
});

test('outline width stays between one and four pixels', () => {
  assert.equal(outlineWidth({ scale: 10 }, 0.01), 1);
  assert.equal(outlineWidth({ scale: 1000 }, 1), 4);
});
