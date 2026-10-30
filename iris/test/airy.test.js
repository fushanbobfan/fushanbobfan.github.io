import { test } from 'node:test';
import assert from 'node:assert/strict';
import { airyAi, airyFactor, airyScale, AIRY_PEAKS } from '../src/airy.js';

function root(f, a, b) {
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (Math.sign(f(m)) === Math.sign(f(a))) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

test('Ai matches tabulated values on both sides', () => {
  assert.ok(Math.abs(airyAi(0) - 0.3550280539) < 1e-9);
  assert.ok(Math.abs(airyAi(1) - 0.1352924163) < 1e-9);
  assert.ok(Math.abs(airyAi(-1) - 0.5355608833) < 1e-9);
  assert.ok(Math.abs(airyAi(-1.018792972) - 0.5356566561) < 1e-9);
  assert.ok(Math.abs(airyAi(6) / 9.9476943602529e-6 - 1) < 1e-5);
});

test('Ai has its zeros where the tables put them, including on the integrated side', () => {
  const zeros = [-2.338107410, -4.087949444, -5.520559828, -6.786708090, -7.944133587];
  for (const z of zeros) assert.ok(Math.abs(root(airyAi, z - 0.2, z + 0.2) - z) < 1e-6, `zero ${z}`);
});

test('the pieces join without a jump at ±5', () => {
  for (const x of [-5, 5]) {
    assert.ok(Math.abs(airyAi(x - 1e-9) - airyAi(x + 1e-9)) < 1e-7);
  }
});

test('the peaks of Ai² are the zeros of its slope', () => {
  const slope = (x) => (airyAi(x + 1e-6) - airyAi(x - 1e-6)) / 2e-6;
  for (const p of AIRY_PEAKS) assert.ok(Math.abs(root(slope, p - 0.2, p + 0.2) - p) < 1e-5);
});

test('far on the bright side the Airy factor averages to the geometric caustic', () => {
  // Windows tens of fringes wide, so a part-fringe at either end hardly counts.
  const s = 1000;
  for (const [a, b] of [[-0.1, -0.05], [-0.09, -0.06]]) {
    let sum = 0;
    let geo = 0;
    const n = 20000;
    for (let j = 0; j < n; j++) {
      const e = a + ((j + 0.5) / n) * (b - a);
      sum += airyFactor(e, s);
      geo += 1 / Math.sqrt(-e);
    }
    assert.ok(Math.abs(sum / geo - 1) < 0.02, `ratio ${sum / geo}`);
  }
});

test('smaller drops spread the bow: the scale goes as a^(2/3) and λ^(-2/3)', () => {
  const s1 = airyScale(9.7, 0.5e-3, 550);
  assert.ok(Math.abs(airyScale(9.7, 2e-3, 550) / s1 - 4 ** (2 / 3)) < 1e-12);
  assert.ok(Math.abs(airyScale(9.7, 0.5e-3, 440) / s1 - 1.25 ** (2 / 3)) < 1e-12);
  // A 1 mm drop puts its main peak about a third of a degree inside the bow.
  const shift = (-AIRY_PEAKS[0] / s1) * (180 / Math.PI);
  assert.ok(shift > 0.25 && shift < 0.4, `shift ${shift}`);
});
