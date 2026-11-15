import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetLayout, fitSheet, cellCentre, columnsThatFit } from '../src/sheet.js';

test('a 60-row course of 12-row leads prints as five columns of 13 lines', () => {
  const layout = sheetLayout(61, 12);
  assert.equal(layout.columns, 5);
  assert.equal(layout.linesPerColumn, 13);
  assert.equal(layout.cells.length, 5 * 13);
});

test('each lead head closes one column and opens the next', () => {
  const { cells } = sheetLayout(61, 12);
  const at12 = cells.filter((c) => c.index === 12);
  assert.deepEqual(at12.map((c) => [c.column, c.line]), [[0, 12], [1, 0]]);
  assert.equal(cells.filter((c) => c.index === 60).length, 1, 'closing rounds once');
  for (let i = 0; i <= 60; i++) assert.ok(cells.some((c) => c.index === i));
});

test('a course shorter than a lead still gets one column', () => {
  const layout = sheetLayout(1, 12);
  assert.equal(layout.columns, 1);
  assert.equal(layout.cells.length, 1);
});

test('the fitted sheet stays inside the width unless the minimum cell forces it wider', () => {
  const layout = sheetLayout(225, 32);
  const fit = fitSheet(layout, 8, 640);
  assert.ok(fit.width <= 640);
  const tight = fitSheet(layout, 8, 100);
  assert.equal(tight.cell, 7);
});

test('cell centres step one cell per place and one line per row', () => {
  const fit = fitSheet(sheetLayout(61, 12), 6, 600);
  const [x0, y0] = cellCentre(fit, 6, 0, 0, 0);
  const [x1, y1] = cellCentre(fit, 6, 0, 1, 1);
  assert.equal(x1 - x0, fit.cell);
  assert.equal(y1 - y0, fit.lineHeight);
  const [xc] = cellCentre(fit, 6, 1, 0, 0);
  assert.equal(xc - x0, 6 * fit.cell + fit.gap);
});

test('a long touch wraps onto bands of at most the given number of columns', () => {
  const layout = sheetLayout(721, 12, 8);
  assert.equal(layout.leads, 60);
  assert.equal(layout.columns, 8);
  assert.equal(layout.bands, 8);
  const lead9 = layout.cells.find((c) => c.index === 9 * 12 + 1);
  assert.deepEqual([lead9.band, lead9.column], [1, 1]);
});

test('bands stack below one another', () => {
  const layout = sheetLayout(721, 12, 8);
  const fit = fitSheet(layout, 6, 600);
  assert.equal(fit.height, 8 * fit.bandHeight);
  const [, y0] = cellCentre(fit, 6, 0, 0, 0, 0);
  const [, y1] = cellCentre(fit, 6, 0, 0, 0, 1);
  assert.equal(y1 - y0, fit.bandHeight);
});

test('columnsThatFit leaves each column at least the smallest cell wide', () => {
  for (const [stage, width] of [[6, 640], [8, 640], [5, 300], [6, 40]]) {
    const n = columnsThatFit(stage, width);
    assert.ok(n >= 1);
    if (n > 1) assert.ok((n * stage + (n - 1) * 1.6) * 9 <= width);
    assert.ok(((n + 1) * stage + n * 1.6) * 9 > width);
  }
});
