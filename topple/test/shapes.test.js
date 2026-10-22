import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, makeMask, activeCells } from '../src/shapes.js';

test('the square switches every cell on', () => {
  const m = makeMask('square', 9);
  assert.ok(m.every((v) => v === 1));
  assert.equal(activeCells(m).length, 81);
});

test('every shape has the eight symmetries of the square', () => {
  for (const shape of Object.keys(SHAPES)) {
    for (const side of [16, 31]) {
      const m = makeMask(shape, side);
      const at = (x, y) => m[y * side + x];
      for (let y = 0; y < side; y++) {
        for (let x = 0; x < side; x++) {
          assert.equal(at(side - 1 - x, y), at(x, y), shape);
          assert.equal(at(y, x), at(x, y), shape);
        }
      }
    }
  }
});

test('areas are close to the continuous shapes', () => {
  const side = 200;
  const area = (shape) => activeCells(makeMask(shape, side)).length / (side * side);
  assert.ok(Math.abs(area('disc') - Math.PI / 4) < 0.01);
  assert.ok(Math.abs(area('diamond') - 0.5) < 0.01);
  assert.ok(Math.abs(area('ring') - (Math.PI / 4) * (1 - 0.45 ** 2)) < 0.01);
});

test('the ring has a hole and the disc does not', () => {
  const side = 41;
  const centre = 20 * side + 20;
  assert.equal(makeMask('ring', side)[centre], 0);
  assert.equal(makeMask('disc', side)[centre], 1);
  assert.equal(makeMask('disc', side)[0], 0);
});

test('unknown shapes fall back to the square', () => {
  assert.ok(makeMask('blob', 5).every((v) => v === 1));
});
