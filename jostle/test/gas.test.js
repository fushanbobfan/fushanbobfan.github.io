import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGas, momentum, temperature, setTemperature, packingFraction,
} from '../src/gas.js';

function minGap(gas) {
  let gap = Infinity;
  for (let i = 0; i < gas.n; i++) {
    for (let j = i + 1; j < gas.n; j++) {
      const d = Math.hypot(gas.x[i] - gas.x[j], gas.y[i] - gas.y[j]);
      gap = Math.min(gap, d - gas.r[i] - gas.r[j]);
    }
  }
  return gap;
}

test('disks start inside the box without overlapping', () => {
  const gas = createGas({ n: 400, radius: 2, width: 100, height: 80, seed: 5 });
  assert.ok(minGap(gas) >= -1e-9);
  for (let i = 0; i < gas.n; i++) {
    assert.ok(gas.x[i] >= gas.r[i] - 1e-9 && gas.x[i] <= gas.width - gas.r[i] + 1e-9);
    assert.ok(gas.y[i] >= gas.r[i] - 1e-9 && gas.y[i] <= gas.height - gas.r[i] + 1e-9);
  }
});

test('the starting gas has the requested temperature and no drift', () => {
  const gas = createGas({ n: 250, kT: 2.5, mass: 3, seed: 9 });
  assert.ok(Math.abs(temperature(gas) - 2.5) < 1e-12);
  const [px, py] = momentum(gas);
  assert.ok(Math.abs(px) < 1e-9 && Math.abs(py) < 1e-9);
});

test('a seed reproduces the same gas', () => {
  const a = createGas({ n: 50, seed: 11 });
  const b = createGas({ n: 50, seed: 11 });
  assert.deepEqual(Array.from(a.x), Array.from(b.x));
  assert.deepEqual(Array.from(a.vy), Array.from(b.vy));
});

test('too many disks for the box is refused', () => {
  assert.throws(() => createGas({ n: 3000, radius: 2, width: 100, height: 100 }), RangeError);
});

test('rescaling sets the temperature exactly', () => {
  const gas = createGas({ n: 100, kT: 1, seed: 2 });
  setTemperature(gas, 0.25);
  assert.ok(Math.abs(temperature(gas) - 0.25) < 1e-12);
});

test('packing fraction is disk area over box area', () => {
  const gas = createGas({ n: 100, radius: 1, width: 100, height: 100 });
  assert.ok(Math.abs(packingFraction(gas) - (100 * Math.PI) / 10000) < 1e-12);
});

test('an equal-speed start gives every disk the same speed and no drift', () => {
  const gas = createGas({ n: 300, kT: 1.5, start: 'equal', seed: 6 });
  const v0 = Math.hypot(gas.vx[0], gas.vy[0]);
  for (let i = 1; i < gas.n; i++) {
    assert.ok(Math.abs(Math.hypot(gas.vx[i], gas.vy[i]) - v0) < 1e-12);
  }
  assert.ok(Math.abs(temperature(gas) - 1.5) < 1e-12);
  const [px, py] = momentum(gas);
  assert.ok(Math.abs(px) < 1e-9 && Math.abs(py) < 1e-9);
});

test('a hot-cold start puts more energy on the left', () => {
  const gas = createGas({ n: 400, kT: 1, start: 'hotcold', seed: 6 });
  let left = 0; let nl = 0; let right = 0; let nr = 0;
  for (let i = 0; i < gas.n; i++) {
    const e = 0.5 * (gas.vx[i] ** 2 + gas.vy[i] ** 2);
    if (gas.x[i] < gas.width / 2) { left += e; nl++; } else { right += e; nr++; }
  }
  assert.ok(left / nl > 2.5 * (right / nr));
  assert.ok(Math.abs(temperature(gas) - 1) < 1e-12);
});

test('a tracer starts in the middle with nothing overlapping it', () => {
  const gas = createGas({ n: 500, radius: 1.2, tracer: { radius: 6, mass: 40 }, seed: 3 });
  assert.equal(gas.r[0], 6);
  assert.equal(gas.m[0], 40);
  assert.equal(gas.x[0], 50);
  assert.equal(gas.y[0], 50);
  assert.ok(minGap(gas) >= -1e-9);
  assert.ok(Math.abs(temperature(gas) - 1) < 1e-12);
});

test('a tracer with an equal-speed start still has no drift', () => {
  const gas = createGas({ n: 300, start: 'equal', tracer: { radius: 4, mass: 25 }, seed: 5 });
  const [px, py] = momentum(gas);
  assert.ok(Math.abs(px) < 1e-9 && Math.abs(py) < 1e-9);
  assert.ok(Math.abs(temperature(gas) - 1) < 1e-12);
});
