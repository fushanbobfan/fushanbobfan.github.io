import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, fitCamera, projector, orbitCamera, zoomCamera, wrapAngle, horizontalAxes, PITCH_LIMIT } from '../src/camera.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('the up axis is drawn upward and the centre lands mid-canvas', () => {
  const cam = createCamera({ up: 2, yaw: 0, pitch: 0 });
  fitCamera(cam, { min: [-1, -1, -1], max: [1, 1, 1], center: [0, 0, 0] });
  const p = projector(cam, 200, 100);
  const out = [];
  p(0, 0, 0, out);
  assert.ok(close(out[0], 100) && close(out[1], 50));
  p(0, 0, 1, out);
  assert.ok(out[1] < 50 && close(out[0], 100), 'z up');
  p(1, 0, 0, out);
  assert.ok(out[0] > 100 && close(out[1], 50), 'x right with no yaw');
  p(0, 1, 0, out);
  assert.ok(close(out[0], 100) && out[2] < 0, 'y into the screen with no yaw, keeping x, y, z right-handed');
});

test('horizontal axes follow the chosen up axis', () => {
  assert.deepEqual(horizontalAxes(2), [0, 1]);
  assert.deepEqual(horizontalAxes(0), [1, 2]);
  assert.deepEqual(horizontalAxes(1), [2, 0]);
});

test('projection is a rotation: lengths on screen plus depth are preserved', () => {
  const cam = createCamera({ up: 2, yaw: 1.1, pitch: -0.4 });
  fitCamera(cam, { min: [-2, -2, -2], max: [2, 2, 2], center: [0, 0, 0] });
  const W = 300;
  const p = projector(cam, W, W);
  const scale = (0.48 * W) / cam.radius;
  const out = [];
  for (const v of [[1, 2, 3], [-0.5, 0.2, 1.7], [0, 0, -2]]) {
    p(...v, out);
    const sx = (out[0] - W / 2) / scale;
    const sy = (out[1] - W / 2) / scale;
    const d = out[2] * cam.radius;
    assert.ok(close(Math.hypot(sx, sy, d), Math.hypot(...v), 1e-9));
  }
});

test('a fitted box stays inside the canvas at any orientation', () => {
  const box = { min: [-20, -27, 1], max: [20, 27, 48], center: [0, 0, 24.5] };
  const out = [];
  for (let yaw = -3; yaw <= 3; yaw += 0.5) {
    for (let pitch = -1.5; pitch <= 1.5; pitch += 0.5) {
      const cam = fitCamera(createCamera({ yaw, pitch }), box);
      const p = projector(cam, 400, 300);
      for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
        p(x, y, z, out);
        assert.ok(out[0] >= 0 && out[0] <= 400 && out[1] >= 0 && out[1] <= 300);
      }
    }
  }
});

test('orbiting wraps yaw and clamps pitch; zoom is bounded', () => {
  const cam = createCamera({ yaw: 3, pitch: 1.5 });
  orbitCamera(cam, 50, 50);
  assert.ok(cam.yaw > -Math.PI && cam.yaw <= Math.PI);
  assert.ok(close(cam.yaw, wrapAngle(3.5)));
  assert.equal(cam.pitch, PITCH_LIMIT);
  zoomCamera(cam, 1000);
  assert.equal(cam.zoom, 12);
  zoomCamera(cam, 1e-6);
  assert.equal(cam.zoom, 0.25);
});
