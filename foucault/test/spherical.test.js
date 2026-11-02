import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, localSpin, solve, release } from '../src/pendulum.js';
import { spinVector, step, start, energy, airyRate, apsides, turnRate } from '../src/spherical.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('the bob stays on its sphere and keeps its energy', () => {
  const L = 3, om = spinVector(48.8, 2000);
  let s = start(L, 1.2, 0.2);
  const e0 = energy(s);
  const dt = 0.002;
  for (let i = 0; i < 20000; i++) s = step(s, dt, L, G, om);
  close(Math.hypot(s[0], s[1], s[2]), L, 1e-12, 'on the sphere');
  close((s[0] * s[3] + s[1] * s[4] + s[2] * s[5]) / L, 0, 1e-12, 'no speed along the wire');
  close(energy(s) / e0, 1, 1e-6, 'energy');
});

test('with no spin, a flat swing keeps its plane even when wide', () => {
  const L = 2;
  const { apsides: ap } = apsides(start(L, 0.6, 0), { L, duration: 200 });
  assert.ok(ap.length > 100);
  for (const p of ap) close(p.angle, Math.PI / 2, 1e-6, `at ${p.t.toFixed(1)} s`);
});

test('with no spin, an elliptical swing turns at Airy\'s rate, in its own sense', () => {
  for (const [L, a, b] of [[2, 0.1, 0.02], [5, 0.3, 0.03], [10, 0.5, 0.1]]) {
    const { apsides: ap } = apsides(start(L, a, b), { L, duration: 600 });
    const rate = turnRate(ap);
    // started north, moving east: the bob goes round clockwise, so the angle falls
    assert.ok(rate < 0, `turns clockwise for L=${L}`);
    close(-rate / airyRate(L, a, b), 1, 0.03, `L=${L} a=${a} b=${b}`);
  }
});

test('a small, flat swing on a long wire turns at the Foucault rate', () => {
  const L = 67, lat = 48.8462, factor = 200;
  const om = spinVector(lat, factor);
  const { apsides: ap, end } = apsides(start(L, 1, 0), { L, om, duration: 1500, stepsPerSwing: 200 });
  close(turnRate(ap) / -localSpin(lat, factor), 1, 0.005, 'rate');
  // and it follows the small-swing closed form
  const omegaZ = localSpin(lat, factor);
  const lin = solve({ length: L, omegaZ, ...release('rest', 1, L, G, omegaZ) });
  const dt = (2 * Math.PI * Math.sqrt(L / G)) / 200;
  const t = Math.ceil(1500 / dt) * dt;
  const m = lin(t);
  close(Math.hypot(end[0] - m.x, end[1] - m.y), 0, 0.02, 'position after 1500 s');
});

test('on a short wire a careless release swamps the Earth', () => {
  // 2 m wire, 20 cm swing, 1 cm sideways: Airy outruns the Earth in Paris
  const L = 2, a = 0.2, b = 0.01, lat = 48.8462;
  assert.ok(airyRate(L, a, b) > Math.abs(localSpin(lat)));
  // the Panthéon wire with a 3 m swing and the same 1 cm slip stays within a few percent
  assert.ok(airyRate(67, 3, 0.01) / Math.abs(localSpin(lat)) < 0.02);
});

test('the slope fit recovers a known rate', () => {
  const pts = Array.from({ length: 50 }, (_, i) => ({ t: i * 2, angle: 1 - 0.003 * i * 2 }));
  close(turnRate(pts), -0.003, 1e-15);
});
