import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, closes } from '../src/grashof.js';
import { crankArc } from '../src/linkage.js';

test('the shortest bar names a Grashof linkage', () => {
  assert.equal(classify({ g: 4, a: 1.5, b: 4, c: 3 }).type, 'crank-rocker');
  assert.equal(classify({ g: 1, a: 3, b: 3.5, c: 2.5 }).type, 'double-crank');
  assert.equal(classify({ g: 4, a: 3, b: 4, c: 1.5 }).type, 'rocker-crank');
  assert.equal(classify({ g: 4, a: 5, b: 2, c: 5 }).type, 'double-rocker');
});

test('s + l > p + q is a triple rocker and s + l = p + q a change point', () => {
  assert.equal(classify({ g: 4.5, a: 2.6, b: 2.6, c: 2.6 }).type, 'triple-rocker');
  assert.equal(classify({ g: 4, a: 2, b: 4, c: 2 }).type, 'change-point');
  assert.equal(classify({ g: 3, a: 3, b: 3, c: 3 }).type, 'change-point');
});

test('a loop with one bar longer than the other three cannot close', () => {
  assert.equal(closes({ g: 10, a: 1, b: 2, c: 3 }), false);
  assert.equal(closes({ g: 4, a: 1, b: 2, c: 3 }), true);
});

test('Grashof agrees with the solver about which inputs turn fully', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let checked = 0;
  for (let i = 0; i < 4000; i++) {
    const link = { A: { x: 0, y: 0 }, D: { x: 0.5 + 4 * rand(), y: 0 }, a: 0.5 + 4 * rand(), b: 0.5 + 4 * rand(), c: 0.5 + 4 * rand() };
    const g = link.D.x;
    const info = classify({ a: link.a, b: link.b, c: link.c, g });
    if (!closes({ a: link.a, b: link.b, c: link.c, g }) || Math.abs(info.margin) < 1e-6) continue;
    // find any angle the loop closes at
    let arc = null;
    for (let k = 0; k < 360 && !arc; k++) arc = crankArc(link, (k * Math.PI) / 180);
    assert.ok(arc, 'a closable loop has some pose');
    assert.equal(arc.full, info.inputTurns, JSON.stringify({ ...link, info }));
    checked++;
  }
  assert.ok(checked > 1500);
});
