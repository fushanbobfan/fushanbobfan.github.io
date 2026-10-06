import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEEDS, assemble, grow } from '../src/tiling.js';
import { PALETTES } from '../src/palettes.js';
import { fitView } from '../src/view.js';
import { RUN, drawTiling, lineWidth, svgDocument } from '../src/render.js';

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
