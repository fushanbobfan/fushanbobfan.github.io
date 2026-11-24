import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAir, temperature, index, dndz } from '../src/air.js';
import { trace, criticalAngle, turningHeight, shineStart } from '../src/rays.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('air at 0 °C and one atmosphere has the textbook refractive index', () => {
  const a = makeAir({ surface: 0, air: 0 });
  close(index(a, 0), 1.000293, 1e-12);
  // 30 °C air: 2.93e-4 * 273.15 / 303.15
  close(index(makeAir({ surface: 30, air: 30 }), 5), 1 + 2.64e-4, 1e-6);
});

test('the temperature runs from the surface value to the air value', () => {
  const a = makeAir({ surface: 55, air: 30, layer: 0.1 });
  assert.equal(temperature(a, 0), 55);
  close(temperature(a, 0.1), 30 + 25 / Math.E, 1e-12);
  close(temperature(a, 3), 30, 1e-9);
  assert.ok(index(a, 0) < index(a, 1), 'hot air near the road bends light less');
});

test('the index gradient matches a finite difference', () => {
  const a = makeAir({ surface: 60, air: 25, layer: 0.05 });
  for (const z of [0.002, 0.02, 0.1, 0.4]) {
    const h = 1e-4;
    const fd = (index(a, z + h) - index(a, z - h)) / (2 * h);
    close(dndz(a, z), fd, Math.abs(fd) * 1e-4 + 1e-11, `z=${z}`);
  }
});

test('with no heating a ray goes straight', () => {
  const a = makeAir({ surface: 25, air: 25 });
  const angle = -Math.atan(1.5 / 300);
  const r = trace(a, 1.5, angle, { stops: [1000] });
  close(r.groundX, 300, 1e-6);
  const up = trace(a, 1.5, 0.002, { stops: [200, 400] });
  close(up.heights[0], 1.5 + 200 * Math.tan(0.002), 1e-9);
  close(up.heights[1], 1.5 + 400 * Math.tan(0.002), 1e-9);
});

test('n cos(theta) stays constant along a ray through the hot layer', () => {
  const a = makeAir({ surface: 55, air: 30, layer: 0.1 });
  const eye = 1.2;
  const angle = -0.9 * criticalAngle(a, eye);
  const want = index(a, eye) * Math.cos(angle);
  const stops = [50, 100, 150, 200, 250, 300, 400];
  const r = trace(a, eye, angle, { stops });
  assert.equal(r.groundX, null);
  stops.forEach((_, i) => close(index(a, r.heights[i]) * Math.cos(r.angles[i]), want, 1e-12, `stop ${i}`));
});

test('rays just shallower than the critical angle turn back; steeper ones hit the road', () => {
  const a = makeAir({ surface: 55, air: 30, layer: 0.1 });
  const c = criticalAngle(a, 1.2);
  // about a third of a degree for a 25 degree difference
  assert.ok(c > 0.004 && c < 0.008, c);
  assert.equal(trace(a, 1.2, -c * 0.995, { stops: [3000] }).groundX, null);
  assert.ok(trace(a, 1.2, -c * 1.005, { stops: [3000] }).groundX > 0);
  assert.equal(criticalAngle(makeAir({ surface: 20, air: 30 }), 1.2), null);
});

test('a ray levels out where the invariant says it should', () => {
  const a = makeAir({ surface: 55, air: 30, layer: 0.1 });
  const eye = 1.2;
  const angle = -0.8 * criticalAngle(a, eye);
  const zt = turningHeight(a, eye, angle);
  const r = trace(a, eye, angle, { stops: [2000], path: true, pathEvery: 1 });
  const lowest = Math.min(...r.path.map((p) => p[1]));
  close(lowest, zt, 2e-4);
  assert.equal(turningHeight(a, eye, -2 * criticalAngle(a, eye)), null);
});

test('the shine starts nearer when the road is hotter and further from a higher eye', () => {
  const at = (surface, eye) => shineStart(makeAir({ surface, air: 30, layer: 0.1 }), eye);
  const base = at(55, 1.2);
  assert.ok(base > 50 && base < 400, base);
  assert.ok(at(70, 1.2) < base);
  assert.ok(at(55, 2.0) > base);
  assert.equal(at(30, 1.2), null);
});
