import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHI, SEEDS, assemble, grow } from '../src/tiling.js';
import { cull, fitView, nearView, patchRadii, rimEdges, toScreen, toWorld } from '../src/view.js';
import { edgeLength } from '../src/tiling.js';

const close = (x, y, eps = 1e-9) => Math.abs(x - y) <= eps;

test('the sun of kites is a regular decagon', () => {
  const seed = SEEDS['p2-sun'].build();
  assert.equal(rimEdges(seed).length, 10);
  const { inner, outer } = patchRadii(seed);
  assert.ok(close(outer, 1));
  assert.ok(close(inner, Math.cos(Math.PI / 10)));
});

test('the star of darts is a five-pointed star with dents', () => {
  const seed = SEEDS['p2-star'].build();
  assert.equal(rimEdges(seed).length, 10);
  const { inner, outer } = patchRadii(seed);
  assert.ok(close(outer, 1));
  assert.ok(inner < 1 / PHI + 1e-9);
});

test('the rim of a grown patch matches the seed outline', () => {
  for (const id of Object.keys(SEEDS)) {
    const a = patchRadii(SEEDS[id].build());
    const b = patchRadii(grow(id, 3));
    assert.ok(close(a.outer, b.outer, 1e-9), id);
    assert.ok(b.inner >= a.inner - 1e-9, id);
  }
});

test('fill view covers the whole canvas with the patch', () => {
  for (const id of Object.keys(SEEDS)) {
    const seed = SEEDS[id].build();
    const v = fitView(seed, 800, 500, { fit: 'fill' });
    const { inner } = patchRadii(seed);
    for (const corner of [
      [0, 0],
      [800, 0],
      [0, 500],
      [800, 500],
    ]) {
      const w = toWorld(v, corner);
      assert.ok(Math.hypot(...w) <= inner + 1e-9, `${id}: corner ${corner} outside the patch`);
    }
  }
});

test('patch view fits the whole patch inside the canvas', () => {
  const seed = SEEDS['p3-sun'].build();
  const v = fitView(seed, 600, 400, { fit: 'patch', margin: 10 });
  for (const t of seed) {
    for (const p of [t.a, t.b, t.c]) {
      const [x, y] = toScreen(v, p);
      assert.ok(x >= 10 - 1e-9 && x <= 590 + 1e-9 && y >= 10 - 1e-9 && y <= 390 + 1e-9);
    }
  }
});

test('screen and world coordinates round-trip, with y pointing up', () => {
  const v = fitView(SEEDS['p2-sun'].build(), 640, 480, { zoom: 2 });
  const p = [0.25, -0.5];
  const s = toScreen(v, p);
  assert.ok(s[1] > v.cy);
  const q = toWorld(v, s);
  assert.ok(close(q[0], p[0]) && close(q[1], p[1]));
});

test('culling keeps only tiles that reach the canvas', () => {
  const id = 'p2-sun';
  const { tiles } = assemble(grow(id, 5), 'p2');
  const wide = fitView(SEEDS[id].build(), 800, 800, { fit: 'patch' });
  assert.equal(cull(tiles, wide).length, tiles.length);
  const zoomed = fitView(SEEDS[id].build(), 800, 800, { fit: 'patch', zoom: 4 });
  const kept = cull(tiles, zoomed);
  assert.ok(kept.length > 0 && kept.length < tiles.length / 4);
  for (const t of kept) {
    const s = t.points.map((p) => toScreen(zoomed, p));
    assert.ok(s.some(([x]) => x >= 0) && s.some(([x]) => x <= 800));
  }
});

test('growing only near the view gives the same visible tiles, all whole', () => {
  const id = 'p3-sun';
  const g = 6;
  const view = fitView(SEEDS[id].build(), 640, 480, { zoom: 3 });
  const full = cull(assemble(grow(id, g), 'p3').tiles, view);
  const lean = assemble(grow(id, g, nearView(view, 2 * edgeLength(g))), 'p3');
  const shown = cull(lean.tiles, view);
  const key = (t) => t.points.map((p) => p.map((x) => x.toFixed(6)).join(',')).join(';');
  assert.deepEqual(new Set(shown.map(key)), new Set(full.map(key)));
  assert.equal(cull(lean.halves, view, (h) => [h.a, h.b, h.c]).length, 0);
  assert.ok(lean.tiles.length < assemble(grow(id, g), 'p3').tiles.length / 3);
});
