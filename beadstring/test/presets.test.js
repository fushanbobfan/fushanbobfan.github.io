import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, SLIDERS, BEADS, initialShape } from '../src/presets.js';
import {
  createString, step, modeEnergies, modeFrequency, positions, velocities, beadEnergies, beatPeriod,
} from '../src/model.js';

const byId = (id) => PRESETS.find((p) => p.id === id);

test('every preset builds a string with motion inside the drawable range', () => {
  const ids = new Set();
  for (const p of PRESETS) {
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    assert.ok(p.n >= BEADS.min && p.n <= BEADS.max, p.id);
    for (const s of SLIDERS) {
      const v = p.params[s.key];
      assert.ok(v >= s.min && v <= s.max, `${p.id} ${s.key}`);
    }
    const shape = initialShape(p.init, p.n);
    assert.equal(shape.length, p.n);
    const peak = Math.max(...shape.map(Math.abs));
    assert.ok(peak > 0.2 && peak <= 1, `${p.id} peak ${peak}`);
    assert.ok(p.note.length > 40);
  }
});

test('starting shapes adapt to any number of beads', () => {
  for (const p of PRESETS) {
    for (let n = BEADS.min; n <= BEADS.max; n++) {
      const shape = initialShape(p.init, n);
      assert.equal(shape.length, n);
      assert.ok(shape.every(Number.isFinite), `${p.id} n=${n}`);
      assert.ok(Math.max(...shape.map(Math.abs)) <= 1, `${p.id} n=${n}`);
    }
  }
});

test('the middle pluck excites only odd modes, for any number of beads', () => {
  const p = byId('middle');
  for (let n = 2; n <= BEADS.max; n++) {
    const e = modeEnergies(createString(n, p.params, initialShape(p.init, n)));
    e.forEach((v, i) => ((i + 1) % 2 === 0 ? assert.ok(v < 1e-24, `n=${n} mode ${i + 1}`) : assert.ok(v > 0)));
  }
});

test('the opposed-neighbours setup stays the top mode for any number of beads', () => {
  const p = byId('zigzag');
  for (let n = 1; n <= BEADS.max; n++) {
    const e = modeEnergies(createString(n, p.params, initialShape(p.init, n)));
    e.forEach((v, i) => (i === n - 1 ? assert.ok(v > 0) : assert.ok(v < 1e-24, `n=${n} mode ${i + 1}`)));
  }
});

test('plucks keep the corner where the setup put it', () => {
  const p = byId('near-end');
  const shape = initialShape(p.init, 24);
  const peakAt = shape.indexOf(Math.max(...shape)) + 1;
  assert.equal(peakAt, 3);
  assert.ok(Math.abs(Math.max(...shape) - 0.6) < 1e-12);
});

test('the opposed-neighbours preset is the top mode, just under twice the coupling', () => {
  const p = byId('zigzag');
  const e = modeEnergies(createString(p.n, p.params, initialShape(p.init, p.n)));
  assert.ok(e[p.n - 1] > 0);
  e.slice(0, -1).forEach((v) => assert.ok(v < 1e-24));
  const w = modeFrequency(p.n, p.n, p.params);
  assert.ok(w < 2 && w > 1.98, `${w}`);
});

test('the coupled pendulums swap their energy', () => {
  const p = byId('beats');
  const s = createString(p.n, p.params, initialShape(p.init, p.n));
  step(s, beatPeriod(p.params) / 2);
  const e = beadEnergies(positions(s), velocities(s), p.params);
  assert.ok(e[1] / (e[0] + e[1]) > 0.85);
});

test('fading out: every mode decays at the damping rate on average', () => {
  const p = byId('damped');
  const g = p.params.damping;
  assert.ok(Math.abs(Math.LN2 / g - 14) < 0.5, 'halving time quoted in the note');
  const s = createString(p.n, p.params, initialShape(p.init, p.n));
  const e0 = modeEnergies(s);
  step(s, 40);
  const e = modeEnergies(s);
  for (let k = 1; k <= p.n; k++) {
    if (e0[k - 1] < 1e-6 * Math.max(...e0)) continue;
    const ratio = e[k - 1] / e0[k - 1] / Math.exp(-g * 40);
    const wobble = (2.5 * g) / modeFrequency(p.n, k, p.params);
    assert.ok(Math.abs(ratio - 1) < wobble, `mode ${k}: ${ratio}`);
  }
});

test('a pulse leaves its starting place on a plain string and lingers on pendulums', () => {
  // Share of the energy still on the first third of the string at t = 30.
  const lingering = (id) => {
    const p = byId(id);
    const s = createString(p.n, p.params, initialShape(p.init, p.n));
    step(s, 30);
    const e = beadEnergies(positions(s), velocities(s), p.params);
    const third = Math.round(p.n / 3);
    return e.slice(0, third).reduce((a, b) => a + b, 0) / e.reduce((a, b) => a + b, 0);
  };
  const plain = lingering('pulse');
  const anchored = lingering('pendulum-pulse');
  assert.ok(plain < 0.1, `plain ${plain}`);
  assert.ok(anchored > 0.45, `anchored ${anchored}`);
});

test('the plain pulse keeps most of its height as it travels', () => {
  const p = byId('pulse');
  const s = createString(p.n, p.params, initialShape(p.init, p.n));
  step(s, 20);
  const peak = Math.max(...positions(s).map(Math.abs));
  assert.ok(peak > 0.25 && peak <= 0.3, `each half is at most half the bump: ${peak}`);
});
