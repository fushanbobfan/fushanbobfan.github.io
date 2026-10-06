import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOURINGS, PALETTES, directionIndex, tileFill } from '../src/palettes.js';

const HEX = /^#[0-9a-f]{6}$/;

test('every palette colours every tile kind and all ten directions', () => {
  for (const [id, p] of Object.entries(PALETTES)) {
    for (const kind of ['kite', 'dart', 'thick', 'thin']) assert.match(p.tiles[kind], HEX, `${id}.${kind}`);
    assert.equal(p.ramp.length, 10, id);
    for (const c of [p.background, p.line, p.overlay, ...p.ramp]) assert.match(c, HEX, id);
  }
});

test('directions are counted in steps of 36 degrees from the chosen start', () => {
  assert.equal(directionIndex(0), 0);
  assert.equal(directionIndex(36), 1);
  assert.equal(directionIndex(324), 9);
  assert.equal(directionIndex(18, 18), 0);
  assert.equal(directionIndex(0, 18), 0);
  assert.equal(directionIndex(342, 18), 9);
});

test('fills follow the colouring', () => {
  const p = PALETTES.slate;
  const tile = { kind: 'dart', axis: 72 };
  assert.equal(tileFill(tile, 'kind', p), p.tiles.dart);
  assert.equal(tileFill(tile, 'direction', p), p.ramp[2]);
  assert.equal(tileFill(tile, 'plain', p), p.background);
  assert.deepEqual(Object.keys(COLOURINGS), ['kind', 'direction', 'plain']);
});
