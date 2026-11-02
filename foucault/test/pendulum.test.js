import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIDEREAL_DAY, EARTH_SPIN, G, localSpin, precessionPeriod, degreesPerHour,
  swingPeriod, solve, release, planeAngle, wrapHalf, rk4, energy,
} from '../src/pendulum.js';

const PARIS = 48.8462; // the Panthéon
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('the plane turns once a sidereal day at the pole and never at the equator', () => {
  close(precessionPeriod(90), SIDEREAL_DAY, 1e-6);
  close(precessionPeriod(-90), SIDEREAL_DAY, 1e-6);
  assert.equal(precessionPeriod(0), Infinity);
  close(degreesPerHour(90), 360 / (SIDEREAL_DAY / 3600), 1e-9);
  close(degreesPerHour(0), 0, 1e-12);
});

test('in Paris a full turn takes about 31.8 hours, at about 11.3 degrees an hour', () => {
  close(precessionPeriod(PARIS) / 3600, 31.8, 0.05);
  close(degreesPerHour(PARIS), 11.3, 0.05);
  close(precessionPeriod(PARIS, 100), precessionPeriod(PARIS) / 100, 1e-6);
});

test('the Panthéon pendulum, 67 m long, swings in about 16.4 seconds', () => {
  close(swingPeriod(67), 16.42, 0.01);
  close(swingPeriod(1, 4 * Math.PI ** 2), 1, 1e-12);
});

test('the closed form matches a direct integration of the equations', () => {
  const length = 10, omegaZ = localSpin(PARIS, 500);
  const start = release('rest', 1, length, G, omegaZ);
  const motion = solve({ length, omegaZ, ...start });
  let s = [start.x0, start.y0, start.vx0, start.vy0];
  const dt = 0.005, steps = 40000; // 200 s, about 32 swings
  for (let i = 0; i < steps; i++) s = rk4(s, dt, G / length, omegaZ);
  const m = motion(dt * steps);
  close(m.x, s[0], 1e-6, 'x');
  close(m.y, s[1], 1e-6, 'y');
  close(m.vx, s[2], 1e-6, 'vx');
  close(m.vy, s[3], 1e-6, 'vy');
});

test('the closed form starts where it was released and keeps its energy', () => {
  const length = 67, omegaZ = localSpin(PARIS, 1000);
  for (const mode of ['rest', 'centre']) {
    const start = release(mode, 3, length, G, omegaZ);
    const motion = solve({ length, omegaZ, ...start });
    const m0 = motion(0);
    close(m0.x, start.x0, 1e-12); close(m0.y, start.y0, 1e-12);
    close(m0.vx, start.vx0, 1e-12); close(m0.vy, start.vy0, 1e-12);
    const e0 = energy(m0, length);
    for (const t of [1, 77.7, 1234, 98765]) close(energy(motion(t), length) / e0, 1, 1e-9, `${mode} t=${t}`);
  }
});

test('released from rest, it stops at the rim and turns its plane at −Ωz', () => {
  const length = 67, omegaZ = localSpin(PARIS, 200);
  const start = release('rest', 1, length, G, omegaZ);
  const motion = solve({ length, omegaZ, ...start });
  const plane = planeAngle(motion, omegaZ, length);
  close(plane(0), Math.PI / 2, 1e-9, 'starts north–south');
  // every turning point lies on the rim, on the current plane
  const om = Math.sqrt(G / length + omegaZ ** 2);
  for (let k = 1; k <= 60; k++) {
    const t = (k * Math.PI) / om;
    const m = motion(t);
    close(Math.hypot(m.x, m.y), 1, 1e-9, `rim at turn ${k}`);
    close(Math.hypot(m.vx, m.vy), 0, 1e-9, `at rest at turn ${k}`);
    const dir = wrapHalf(Math.atan2(m.y, m.x));
    const d = Math.abs(dir - plane(t));
    close(Math.min(d, Math.PI - d), 0, 1e-9, `on the plane at turn ${k}`);
  }
  // clockwise from above in the north: the angle falls
  const later = plane(0.25 * precessionPeriod(PARIS, 200));
  close(Math.min(later, Math.PI - later), 0, 1e-9, 'a quarter period later the swing is east–west');
});

test('in the south the plane turns the other way', () => {
  const length = 20;
  for (const lat of [30, -30]) {
    const omegaZ = localSpin(lat, 300);
    const motion = solve({ length, omegaZ, ...release('rest', 1, length, G, omegaZ) });
    const plane = planeAngle(motion, omegaZ, length);
    const t = 0.1 * precessionPeriod(lat, 300); // a tenth of a turn
    const turned = wrapHalf(plane(t) - plane(0) + Math.PI / 2) - Math.PI / 2;
    close(turned, lat > 0 ? -Math.PI / 5 : Math.PI / 5, 1e-9, `lat ${lat}`);
  }
});

test('at the equator the swing keeps its line', () => {
  const length = 5;
  const motion = solve({ length, omegaZ: localSpin(0, 1000), ...release('rest', 1, length) });
  for (const t of [10, 100, 1000, 10000]) close(motion(t).x, 0, 1e-12, `t=${t}`);
});

test('pushed from the centre, it passes back through the centre every half swing', () => {
  const length = 67, omegaZ = localSpin(PARIS, 300);
  const motion = solve({ length, omegaZ, ...release('centre', 1, length, G, omegaZ) });
  const om = Math.sqrt(G / length + omegaZ ** 2);
  let reach = 0;
  for (let k = 1; k <= 40; k++) {
    const m = motion((k * Math.PI) / om);
    close(Math.hypot(m.x, m.y), 0, 1e-12, `centre at ${k}`);
    reach = Math.max(reach, Math.hypot(...Object.values(motion(((k - 0.5) * Math.PI) / om)).slice(0, 2)));
  }
  close(reach, 1, 1e-9, 'its widest point is the amplitude');
});

test('the spin of the Earth is 2π per sidereal day', () => {
  close(EARTH_SPIN, 7.2921159e-5, 1e-12);
  close(localSpin(30), EARTH_SPIN / 2, 1e-15);
});

test('a release along any direction starts its swing on that line', () => {
  const length = 30, omegaZ = localSpin(60, 400);
  for (const dir of [0, 0.7, 2.5, -1.2]) {
    for (const mode of ['rest', 'centre']) {
      const motion = solve({ length, omegaZ, ...release(mode, 1, length, G, omegaZ, dir) });
      const plane = planeAngle(motion, omegaZ, length);
      const d = Math.abs(plane(0) - wrapHalf(dir));
      close(Math.min(d, Math.PI - d), 0, 1e-9, `${mode} ${dir}`);
    }
  }
});
