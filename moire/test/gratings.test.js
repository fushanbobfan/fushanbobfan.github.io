import test from 'node:test';
import assert from 'node:assert/strict';
import { boxInk, inkAt, inkUpTo, makeLayer, phases, MAX_DOT_DUTY } from '../src/gratings.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('ink accumulates duty per whole cycle', () => {
  close(inkUpTo(0, 0.3), 0);
  close(inkUpTo(0.2, 0.3), 0.2);
  close(inkUpTo(0.8, 0.3), 0.3);
  close(inkUpTo(3.1, 0.3), 1.0);
  close(inkUpTo(-1, 0.3), -0.3);
});

test('box filter averages the square wave exactly', () => {
  // A window of a whole cycle sees exactly the duty, wherever it sits.
  for (const t of [0, 0.13, 0.5, 7.77, -2.4]) close(boxInk(t, 1, 0.35), 0.35);
  // Fully inside a bar, fully inside a gap.
  close(boxInk(0.2, 0.1, 0.5), 1);
  close(boxInk(0.7, 0.1, 0.5), 0);
  // Straddling the bar's end at 0.5: half inked.
  close(boxInk(0.5, 0.2, 0.5), 0.5);
  // Zero width falls back to a point sample.
  assert.equal(boxInk(0.2, 0, 0.5), 1);
  assert.equal(boxInk(0.6, 0, 0.5), 0);
});

test('lines run across their angle and repeat with the period', () => {
  const layer = makeLayer({ period: 8, angle: Math.PI / 2 });
  // Turned 90°, the bars are horizontal: moving in x changes nothing.
  close(phases(layer, 0, 3)[0], phases(layer, 50, 3)[0]);
  close(phases(layer, 0, 11)[0] - phases(layer, 0, 3)[0], 1);
});

test('rings depend only on the distance from their centre', () => {
  const layer = makeLayer({ kind: 'rings', period: 5, x: 10, y: 10 });
  close(phases(layer, 13, 14)[0], 1);
  close(phases(layer, 7, 6)[0], 1);
});

test('dots have two phases and stay inside their cell', () => {
  const layer = makeLayer({ kind: 'dots', period: 10, duty: 0.3 });
  assert.equal(phases(layer, 3, 4).length, 2);
  assert.equal(inkAt(layer, 0, 0), 1);
  assert.equal(inkAt(layer, 5, 5), 0);
  assert.equal(inkAt(layer, 20, 30), 1);
});

test('average ink over a large area matches the duty', () => {
  for (const [kind, duty] of [['lines', 0.4], ['rings', 0.25], ['dots', 0.3]]) {
    const layer = makeLayer({ kind, period: 7.3, angle: 0.37, duty, x: 40, y: 40 });
    let sum = 0;
    const n = 200;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) sum += inkAt(layer, x + 0.5, y + 0.5);
    close(sum / (n * n), duty, 0.02);
  }
});

test('oversized dots are capped so neighbours never merge', () => {
  const layer = makeLayer({ kind: 'dots', period: 10, duty: 0.95 });
  assert.ok(MAX_DOT_DUTY < 0.8);
  // The cell corner stays clear.
  assert.ok(inkAt(layer, 5, 5) < 0.5);
});
