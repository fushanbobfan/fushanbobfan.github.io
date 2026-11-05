import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSICAL, angleGap, curvature, energy, thirdDerivative, torque, wrapAngle,
} from '../src/machine.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('wrapAngle lands in [-pi, pi)', () => {
  close(wrapAngle(3 * Math.PI / 2), -Math.PI / 2, 1e-12);
  close(wrapAngle(-3 * Math.PI / 2), Math.PI / 2, 1e-12);
  close(wrapAngle(Math.PI), -Math.PI, 1e-12);
  close(angleGap(3, -3), 2 * Math.PI - 6, 1e-12);
});

test('energy is the two bands stretched from the pin', () => {
  // Pin at (0.5, 0), C at (-3, 0): bands of length 1.5 and 3.5, natural length 1.
  close(energy(CLASSICAL, -3, 0, 0), 0.5 * 0.5 ** 2 + 0.5 * 2.5 ** 2, 1e-12);
});

test('a slack band stores no energy and exerts no torque', () => {
  const m = CLASSICAL;
  // C sits on the pin, so its band is slack and only the fixed band acts.
  const onlyA = 0.5 * (1.5 - 1) ** 2;
  close(energy(m, 0.5, 0, 0), onlyA, 1e-12);
  const theta = 0.7;
  const pin = { x: 0.5 * Math.cos(theta), y: 0.5 * Math.sin(theta) };
  const la = Math.hypot(2 - pin.x, pin.y);
  close(torque(m, pin.x, pin.y, theta), (1 - 1 / la) * 0.5 * 2 * Math.sin(theta), 1e-12);
});

test('torque, curvature and the third derivative match finite differences', () => {
  const machines = [CLASSICAL, { r: 0.5, a: 2.4, l: 0.8, s: 1.6 }];
  const h = 1e-5;
  for (const m of machines) {
    for (const [cx, cy] of [[-3, 0.4], [-1.9, -0.8], [-2.4, 1.3]]) {
      for (let theta = -3; theta < 3; theta += 0.37) {
        close(torque(m, cx, cy, theta),
          (energy(m, cx, cy, theta + h) - energy(m, cx, cy, theta - h)) / (2 * h), 1e-8, 'torque');
        close(curvature(m, cx, cy, theta),
          (torque(m, cx, cy, theta + h) - torque(m, cx, cy, theta - h)) / (2 * h), 1e-8, 'curvature');
        close(thirdDerivative(m, cx, cy, theta),
          (curvature(m, cx, cy, theta + h) - curvature(m, cx, cy, theta - h)) / (2 * h), 1e-8, 'third');
      }
    }
  }
});

test('the machine is mirror symmetric in the x axis', () => {
  const m = CLASSICAL;
  close(energy(m, -2.5, 0.6, 1.1), energy(m, -2.5, -0.6, -1.1), 1e-12);
  close(torque(m, -2.5, 0.6, 1.1), -torque(m, -2.5, -0.6, -1.1), 1e-12);
  close(curvature(m, -2.5, 0.6, 1.1), curvature(m, -2.5, -0.6, -1.1), 1e-12);
});
