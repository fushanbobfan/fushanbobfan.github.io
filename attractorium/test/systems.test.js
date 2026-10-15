import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEMS, SYSTEM_KEYS, defaultParams } from '../src/systems.js';

test('every system declares what the page needs', () => {
  for (const key of SYSTEM_KEYS) {
    const s = SYSTEMS[key];
    assert.equal(typeof s.name, 'string', key);
    assert.equal(s.equations.length, 3, key);
    assert.equal(s.start.length, 3, key);
    assert.ok(s.dt > 0 && s.dt <= 0.05, key);
    assert.ok([0, 1, 2].includes(s.up), key);
    for (const q of s.params) {
      assert.ok(q.min <= q.value && q.value <= q.max, `${key}.${q.key} default within range`);
      assert.ok(q.step > 0, `${key}.${q.key} step`);
    }
  }
});

test('defaultParams copies the default of every parameter', () => {
  assert.deepEqual(defaultParams('lorenz'), { sigma: 10, rho: 28, beta: 8 / 3 });
  assert.deepEqual(Object.keys(defaultParams('aizawa')), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('listed equilibria are zeros of the vector field', () => {
  const out = new Float64Array(3);
  const cases = [
    ['lorenz', {}],
    ['lorenz', { rho: 0.5 }],
    ['rossler', {}],
    ['rossler', { c: 2.5 }],
    ['chen', {}],
    ['aizawa', {}],
    ['aizawa', { a: 1.1, c: 0.2 }],
  ];
  for (const [key, over] of cases) {
    const s = SYSTEMS[key];
    const p = { ...defaultParams(key), ...over };
    const eq = s.equilibria(p);
    assert.ok(eq.length > 0, key);
    for (const e of eq) {
      s.field(p, e, out);
      assert.ok(Math.hypot(...out) < 1e-9, `${key} ${JSON.stringify(over)} at ${e}: |f| = ${Math.hypot(...out)}`);
    }
  }
});

test('equilibrium counts follow the parameters', () => {
  assert.equal(SYSTEMS.lorenz.equilibria({ ...defaultParams('lorenz'), rho: 0.5 }).length, 1);
  assert.equal(SYSTEMS.lorenz.equilibria(defaultParams('lorenz')).length, 3);
  assert.deepEqual(
    SYSTEMS.chen.equilibria(defaultParams('chen')).map((e) => e.map((v) => +v.toFixed(6))),
    [[0, 0, 0], [7.937254, 7.937254, 21], [-7.937254, -7.937254, 21]],
  );
  // Aizawa's cubic c + az - z^3/3 has three real roots at the defaults.
  assert.equal(SYSTEMS.aizawa.equilibria(defaultParams('aizawa')).length, 3);
  assert.equal(SYSTEMS.aizawa.equilibria({ ...defaultParams('aizawa'), a: 0.5, c: 1 }).length, 1);
});

test('Lorenz and Chen are symmetric under (x, y, z) -> (-x, -y, z)', () => {
  const a = new Float64Array(3);
  const b = new Float64Array(3);
  for (const key of ['lorenz', 'chen']) {
    const p = defaultParams(key);
    const s = [3.1, -4.7, 18.2];
    SYSTEMS[key].field(p, s, a);
    SYSTEMS[key].field(p, [-s[0], -s[1], s[2]], b);
    assert.ok(Math.abs(a[0] + b[0]) < 1e-12 && Math.abs(a[1] + b[1]) < 1e-12 && Math.abs(a[2] - b[2]) < 1e-12, key);
  }
});

test('Thomas and Halvorsen are symmetric under the cyclic shift x -> y -> z -> x', () => {
  const a = new Float64Array(3);
  const b = new Float64Array(3);
  for (const key of ['thomas', 'halvorsen']) {
    const p = defaultParams(key);
    SYSTEMS[key].field(p, [0.3, -1.2, 2.5], a);
    SYSTEMS[key].field(p, [-1.2, 2.5, 0.3], b);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[(i + 1) % 3] - b[i]) < 1e-12, key);
  }
});
