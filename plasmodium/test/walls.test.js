import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintWalls, carveMaze, shortestRoute, encodeWalls, decodeWalls } from '../src/walls.js';
import { createTrail, isWall, setWall } from '../src/trail.js';
import { createRng } from '../src/rng.js';

test('painting and erasing a disc of wall', () => {
  const t = createTrail(20, 20);
  assert.equal(paintWalls(t, 10, 10, 2, true), 13);
  assert.equal(t.wallCount, 13);
  assert.equal(paintWalls(t, 10, 10, 2, true), 0);
  assert.equal(paintWalls(t, 10, 10, 1, false), 5);
  assert.equal(t.wallCount, 8);
  assert.equal(paintWalls(t, 0, 0, 2, true), 6);
});

test('a perfect maze joins every room by exactly one route', () => {
  const t = createTrail(200, 150);
  const m = carveMaze(t, { corridor: 8, thickness: 3 }, createRng(4));
  let passages = 0;
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) passages += m.east[r][c] + m.south[r][c];
  }
  // A tree on rows * cols rooms has one passage fewer than it has rooms.
  assert.equal(passages, m.rows * m.cols - 1);
  assert.equal(m.rows, Math.floor(147 / 11));
  assert.equal(m.cols, Math.floor(197 / 11));
});

test('the route runs from the first room to the last through open passages', () => {
  const t = createTrail(160, 120);
  const m = carveMaze(t, { corridor: 8, thickness: 3 }, createRng(9));
  assert.deepEqual(m.route[0], [0, 0]);
  assert.deepEqual(m.route[m.route.length - 1], [m.rows - 1, m.cols - 1]);
  for (let k = 1; k < m.route.length; k++) {
    const [r0, c0] = m.route[k - 1];
    const [r1, c1] = m.route[k];
    assert.equal(Math.abs(r0 - r1) + Math.abs(c0 - c1), 1);
    const open = r0 === r1 ? m.east[r0][Math.min(c0, c1)] : m.south[Math.min(r0, r1)][c0];
    assert.ok(open);
  }
});

test('room centres and food are open, the rim is wall', () => {
  const t = createTrail(160, 120);
  const m = carveMaze(t, { corridor: 8, thickness: 3 }, createRng(1));
  for (const f of m.foods) assert.ok(!isWall(t, f.x, f.y, false));
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      const p = m.roomCentre(r, c);
      assert.ok(!isWall(t, p.x, p.y, false));
    }
  }
  assert.ok(isWall(t, 0, 0, false));
  assert.ok(isWall(t, 159, 119, false));
});

test('knocking through walls adds passages and never lengthens the route', () => {
  const plain = carveMaze(createTrail(200, 150), { corridor: 8, thickness: 3 }, createRng(2));
  const loopy = carveMaze(createTrail(200, 150), { corridor: 8, thickness: 3, loops: 0.3 }, createRng(2));
  const count = (m) => m.east.flat().filter(Boolean).length + m.south.flat().filter(Boolean).length;
  assert.ok(count(loopy) > count(plain));
  assert.ok(loopy.route.length <= plain.route.length);
});

test('a route that does not exist comes back empty', () => {
  const east = [[false, false]];
  const south = [[false, false]];
  assert.deepEqual(shortestRoute(1, 2, east, south, [0, 0], [0, 1]), []);
});

test('walls survive a run-length round trip', () => {
  const t = createTrail(60, 40);
  carveMaze(t, { corridor: 6, thickness: 2, loops: 0.1 }, createRng(3));
  const code = encodeWalls(t);
  const u = createTrail(60, 40);
  assert.ok(decodeWalls(u, code));
  assert.deepEqual(u.walls, t.walls);
  assert.equal(u.wallCount, t.wallCount);
});

test('a dish starting with a wall encodes a leading empty run', () => {
  const t = createTrail(3, 1);
  setWall(t, 0, true);
  assert.equal(encodeWalls(t), '0-1-2');
  const u = createTrail(3, 1);
  decodeWalls(u, '0-1-2');
  assert.deepEqual([...u.walls], [1, 0, 0]);
});

test('bad wall codes are refused and leave no walls', () => {
  const t = createTrail(4, 4);
  assert.equal(encodeWalls(t), '');
  assert.equal(decodeWalls(t, '3-4'), false);
  assert.equal(decodeWalls(t, 'zz-!'), false);
  assert.equal(t.wallCount, 0);
});
