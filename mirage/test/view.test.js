import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAir } from '../src/air.js';
import { viewRows, viewAngles, renderView, describeView, boardBand, BOARD_HEIGHT } from '../src/view.js';

const scene = { eye: 1.2, distance: 300 };
const palette = Object.fromEntries(
  ['post', 'red', 'white', 'blue', 'road', 'verge', 'paint', 'haze', 'horizon', 'zenith'].map((k, i) => [k, [i * 20, 100, 200 - i * 10]]),
);

test('the board is banded from the ground up', () => {
  assert.equal(boardBand(0.1), 'post');
  assert.equal(boardBand(0.5), 'red');
  assert.equal(boardBand(1.0), 'white');
  assert.equal(boardBand(1.5), 'blue');
  assert.equal(boardBand(BOARD_HEIGHT + 0.01), null);
  assert.equal(boardBand(-0.01), null);
});

test('the view runs from above the board to below the shine', () => {
  const a = makeAir();
  const { top, bottom } = viewAngles(a, scene);
  assert.ok(top > (BOARD_HEIGHT - scene.eye) / scene.distance);
  assert.ok(bottom < -scene.eye / scene.distance);
  const rows = viewRows(a, scene, 50);
  assert.equal(rows.length, 50);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].angle < rows[i - 1].angle, 'top row first');
});

test('without heating the road below the horizon is road, and the board appears once', () => {
  const rows = viewRows(makeAir({ surface: 30, air: 30 }), scene, 120);
  const d = describeView(rows);
  assert.equal(d.skyBelowHorizon, false);
  assert.equal(d.invertedRows, 0);
  assert.ok(d.uprightRows > 20);
  // Heights on the board fall steadily from the top row down.
  const z = rows.filter((r) => r.board.kind === 'board').map((r) => r.board.z);
  for (let i = 1; i < z.length; i++) assert.ok(z[i] < z[i - 1]);
});

test('over a hot road the sky shows below the horizon and the board has an upside-down copy', () => {
  const rows = viewRows(makeAir({ surface: 55, air: 30, layer: 0.1 }), scene, 120);
  const d = describeView(rows);
  assert.equal(d.skyBelowHorizon, true);
  assert.ok(d.invertedRows > 5);
  assert.ok(d.invertedTop > 0.1 && d.invertedTop < BOARD_HEIGHT);
  // Going down the picture, heights on the board fall to a fold and then rise
  // again: the lower copy is upside down.
  const z = rows.filter((r) => r.board.kind === 'board').map((r) => r.board.z);
  const k = z.indexOf(Math.min(...z));
  assert.ok(k > 0 && k < z.length - 1);
  for (let i = 1; i <= k; i++) assert.ok(z[i] < z[i - 1]);
  for (let i = k + 1; i < z.length; i++) assert.ok(z[i] > z[i - 1]);
  // Rays in the lower copy reach the board heading upwards, after turning.
  for (const r of rows) if (r.board.kind === 'board' && r.board.turned) assert.ok(r.angle < 0);
});

test('a ray still heading down at the far edge counts as distant ground, never sky', () => {
  const rows = viewRows(makeAir({ surface: 25, air: 25 }), { eye: 1.2, distance: 300 }, 200);
  for (const r of rows) if (r.angle < 0) assert.equal(r.open.kind, 'ground');
});

test('the rendered view is opaque and the right size', () => {
  const { data, rows } = renderView(makeAir(), scene, 64, 32, palette);
  assert.equal(data.length, 64 * 32 * 4);
  assert.equal(rows.length, 32);
  for (let k = 3; k < data.length; k += 4) assert.equal(data[k], 255);
  // The middle column passes through the board, the edge column beside it.
  const at = (i, j) => [...data.slice((j * 64 + i) * 4, (j * 64 + i) * 4 + 3)];
  const j = rows.findIndex((r) => r.board.kind === 'board' && r.board.band === 'white');
  assert.notDeepEqual(at(32, j), at(0, j));
});
