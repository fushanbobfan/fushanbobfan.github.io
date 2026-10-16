import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chordName, pitchClasses, sameTriad } from '../src/chords.js';
import { TRANSFORMS, shortestWord } from '../src/plr.js';
import {
  pcAt, toScreen, toLattice, triangleVertices, triangleTriad, triangleCentroid, neighbour, walk,
  triangleAt, nodeAt, trianglesOf, nearestTriangleOf, sameTriangle, trianglesWithin,
} from '../src/lattice.js';

const sorted = (a) => a.slice().sort((x, y) => x - y);

test('the axes step by fifths, major thirds and minor thirds', () => {
  assert.equal(pcAt(0, 0), 0);
  assert.equal(pcAt(1, 0), 7);
  assert.equal(pcAt(0, 1), 4);
  assert.equal(pcAt(1, -1), 3);
  assert.equal(pcAt(12, 0), 0);
  assert.equal(pcAt(0, 3), 0);
});

test('screen and lattice coordinates invert each other', () => {
  for (const [q, r] of [[0, 0], [3, -2], [-5, 7]]) {
    const p = toScreen(q, r);
    const back = toLattice(p.x, p.y);
    assert.ok(Math.abs(back.q - q) < 1e-12 && Math.abs(back.r - r) < 1e-12);
  }
  const a = toScreen(0, 0);
  for (const [q, r] of [[1, 0], [0, 1], [1, -1]]) {
    const b = toScreen(q, r);
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 1) < 1e-12);
  }
});

test('up triangles are major, down triangles minor, and vertices spell the triad', () => {
  assert.equal(chordName(triangleTriad({ q: 0, r: 0, up: true })), 'C');
  assert.equal(chordName(triangleTriad({ q: 0, r: 0, up: false })), 'Em');
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      for (const up of [true, false]) {
        const tri = { q, r, up };
        const pcs = triangleVertices(tri).map(([a, b]) => pcAt(a, b));
        assert.deepEqual(sorted(pcs), sorted(pitchClasses(triangleTriad(tri))));
      }
    }
  }
});

test('neighbours across each edge are the P, L and R images and share that edge', () => {
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      for (const up of [true, false]) {
        const tri = { q, r, up };
        for (const k of 'PLR') {
          const n = neighbour(tri, k);
          assert.ok(sameTriad(triangleTriad(n), TRANSFORMS[k](triangleTriad(tri))), `${k} from ${JSON.stringify(tri)}`);
          const key = ([a, b]) => `${a},${b}`;
          const shared = triangleVertices(tri).map(key).filter((v) => triangleVertices(n).map(key).includes(v));
          assert.equal(shared.length, 2);
          assert.ok(sameTriangle(neighbour(n, k), tri));
        }
      }
    }
  }
});

test('walking a shortest word lands on a copy of the target triad', () => {
  const start = { q: 0, r: 0, up: true };
  const target = { root: 2, quality: 'm' };
  const path = walk(start, shortestWord(triangleTriad(start), target));
  assert.ok(sameTriad(triangleTriad(path[path.length - 1]), target));
  assert.equal(path.length, shortestWord(triangleTriad(start), target).length + 1);
});

test('a point inside a triangle hits that triangle', () => {
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      for (const up of [true, false]) {
        const c = triangleCentroid({ q, r, up });
        assert.deepEqual(triangleAt(c.x, c.y), { q, r, up });
      }
    }
  }
});

test('the nearest node is found from nearby points', () => {
  const p = toScreen(2, -1);
  const n = nodeAt(p.x + 0.1, p.y - 0.05);
  assert.equal(n.q, 2);
  assert.equal(n.r, -1);
  assert.ok(n.distance < 0.12);
});

test('copies of a triad repeat on their own lattice', () => {
  const box = { x0: -6, x1: 6, y0: -6, y1: 6 };
  const cs = trianglesOf({ root: 0, quality: 'M' }, box);
  assert.ok(cs.length >= 4);
  for (const tri of cs) assert.equal(chordName(triangleTriad(tri)), 'C');
  const near = nearestTriangleOf({ root: 9, quality: 'm' }, 0.5, -0.3);
  assert.equal(chordName(triangleTriad(near)), 'Am');
  assert.ok(sameTriangle(near, neighbour({ q: 0, r: 0, up: true }, 'R')));
});

test('held sets fill the triangles of the triads they contain', () => {
  const box = { x0: -2, x1: 3, y0: -2, y1: 2 };
  const maj7 = trianglesWithin([0, 4, 7, 11], box);
  const names = new Set(maj7.map((t) => chordName(triangleTriad(t))));
  assert.deepEqual([...names].sort(), ['C', 'Em']);
  const adjacent = maj7.some((a) => maj7.some((b) => sameTriangle(neighbour(a, 'L'), b)));
  assert.ok(adjacent, 'Cmaj7 shows as C and Em sharing an edge');
  assert.equal(trianglesWithin([0, 4, 8], box).length, 0);
  assert.equal(trianglesWithin([0, 7], box).length, 0);
  const g7 = new Set(trianglesWithin([7, 11, 2, 5], box).map((t) => chordName(triangleTriad(t))));
  assert.deepEqual([...g7], ['G']);
});
