import test from 'node:test';
import assert from 'node:assert/strict';
import { vec, hitPiece, normalAt, add, scale, dot, sub } from '../src/geometry.js';
import {
  makeElement, piecesOf, raysOf, prismPoints, outlineOf,
} from '../src/elements.js';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

// Endpoints of a piece, for checking that shapes are closed.
function ends(p) {
  if (p.type === 'segment') return [p.a, p.b];
  const at = (a) => vec(p.c.x + p.r * Math.cos(a), p.c.y + p.r * Math.sin(a));
  return [at(p.a0), at(p.a0 + p.span)];
}

function assertClosed(pieces) {
  const pts = pieces.flatMap(ends);
  for (const p of pts) {
    const matches = pts.filter((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6);
    assert.ok(matches.length >= 2, `dangling endpoint ${p.x},${p.y}`);
  }
}

// Count boundary crossings along a horizontal line through the element.
function crossings(pieces, y, from = -1000) {
  let o = vec(from, y);
  let n = 0;
  for (let k = 0; k < 20; k++) {
    let best = Infinity;
    for (const p of pieces) best = Math.min(best, hitPiece(o, vec(1, 0), p));
    if (best === Infinity) break;
    o = add(o, vec(best + 1e-6, 0));
    n++;
  }
  return n;
}

test('every glass shape is a closed outline', () => {
  for (const kind of ['prism', 'block', 'convexLens', 'concaveLens']) {
    for (const angle of [0, 0.7, -2]) {
      assertClosed(piecesOf(makeElement(kind, 300, 200, angle)));
    }
  }
});

test('a horizontal line through the middle of each glass shape crosses it twice', () => {
  for (const kind of ['prism', 'block', 'convexLens', 'concaveLens', 'ball']) {
    const el = makeElement(kind, 0, 0);
    assert.equal(crossings(piecesOf(el), 5), 2, kind);
  }
});

test('outward normals point away from the element centre', () => {
  for (const kind of ['prism', 'block', 'convexLens', 'ball']) {
    const el = makeElement(kind, 50, -20, 0.4);
    for (const p of piecesOf(el)) {
      const [a, b] = ends(p);
      const mid = p.type === 'segment'
        ? scale(add(a, b), 0.5)
        : vec(p.c.x + p.r * Math.cos(p.a0 + p.span / 2), p.c.y + p.r * Math.sin(p.a0 + p.span / 2));
      assert.ok(dot(normalAt(p, mid), sub(mid, vec(el.x, el.y))) > 0, kind);
    }
  }
});

test('concave lens is thinner in the middle than at the rim', () => {
  const el = makeElement('concaveLens', 0, 0);
  const pieces = piecesOf(el);
  const width = (y) => {
    const o = vec(-1000, y);
    const t1 = Math.min(...pieces.map((p) => hitPiece(o, vec(1, 0), p)));
    const o2 = add(o, vec(t1 + 1e-6, 0));
    const t2 = Math.min(...pieces.map((p) => hitPiece(o2, vec(1, 0), p)));
    return t2;
  };
  assert.ok(width(0) < width(el.aperture * 0.9));
});

test('prism has the requested apex angle and is centred on its centroid', () => {
  const el = makeElement('prism', 10, 20, 0, { apex: 45, side: 200 });
  const [apex, b1, b2] = prismPoints(el);
  const u = sub(b1, apex);
  const v = sub(b2, apex);
  const angle = Math.acos(dot(u, v) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)));
  close((angle * 180) / Math.PI, 45);
  close((apex.x + b1.x + b2.x) / 3, 10);
  close((apex.y + b1.y + b2.y) / 3, 20);
});

test('mirrors and blockers carry their role', () => {
  assert.equal(piecesOf(makeElement('mirror', 0, 0))[0].role, 'mirror');
  assert.equal(piecesOf(makeElement('curvedMirror', 0, 0))[0].role, 'mirror');
  assert.equal(piecesOf(makeElement('blocker', 0, 0))[0].role, 'absorber');
  assert.equal(piecesOf(makeElement('prism', 0, 0))[0].role, 'glass');
});

test('sources emit the requested rays', () => {
  const laser = raysOf(makeElement('laser', 1, 2, Math.PI / 2));
  assert.equal(laser.length, 1);
  close(laser[0].d.y, 1);

  const beam = raysOf(makeElement('beam', 0, 0, 0, { width: 100, count: 5 }));
  assert.equal(beam.length, 5);
  close(beam[0].o.y, -50);
  close(beam[4].o.y, 50);
  for (const r of beam) close(r.d.x, 1);

  const ring = raysOf(makeElement('point', 0, 0, 0, { count: 8, spread: 360 }));
  assert.equal(ring.length, 8);
  const sum = ring.reduce((s, r) => add(s, r.d), vec(0, 0));
  close(sum.x, 0);
  close(sum.y, 0);

  const fan = raysOf(makeElement('point', 0, 0, 0, { count: 3, spread: 90 }));
  close(Math.atan2(fan[0].d.y, fan[0].d.x), -Math.PI / 4);
  close(Math.atan2(fan[2].d.y, fan[2].d.x), Math.PI / 4);
});

test('unknown kinds are rejected', () => {
  assert.throws(() => makeElement('wormhole', 0, 0));
});

test('outlines join every piece into one closed loop', () => {
  for (const kind of ['prism', 'block', 'convexLens', 'concaveLens', 'ball']) {
    const path = outlineOf(makeElement(kind, 40, 60, 0.3));
    const first = path[0];
    const last = path[path.length - 1];
    assert.ok(Math.hypot(first.x - last.x, first.y - last.y) < 1e-6, kind);
    for (let i = 1; i < path.length; i++) {
      const gap = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      assert.ok(gap < 400, `${kind} jumps ${gap}`);
    }
  }
  assert.equal(outlineOf(makeElement('laser', 0, 0)).length, 0);
  assert.equal(outlineOf(makeElement('mirror', 0, 0)).length, 2);
});
