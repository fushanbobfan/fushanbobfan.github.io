import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tangentCone, turnedAfter, onSheet } from '../src/cone.js';
import { localSpin, SIDEREAL_DAY } from '../src/pendulum.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const signedAngle = (u, v) => Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);

test('the cone touches the globe along the parallel', () => {
  for (const lat of [10, 30, 48.8, 75, -40]) {
    const c = tangentCone(lat, 2);
    // generator from the apex to the parallel is square to the radius there
    const gx = c.ring.radius, gy = c.ring.height - c.apex;
    close(gx * c.ring.radius + gy * c.ring.height, 0, 1e-12, `lat ${lat}`);
    close(Math.hypot(gx, gy), c.slant, 1e-12, `slant at ${lat}`);
  }
});

test('laid flat, the parallel keeps its length', () => {
  for (const lat of [5, 20, 48.8, 89, -60]) {
    const c = tangentCone(lat);
    close(c.slant * c.sector, 2 * Math.PI * c.ring.radius, 1e-12, `lat ${lat}`);
  }
});

test('the sheet is a full disc at the pole and a strip at the equator', () => {
  close(tangentCone(90).sector, 2 * Math.PI, 1e-12);
  close(tangentCone(30).sector, Math.PI, 1e-12, 'half a disc at 30°');
  const eq = tangentCone(0);
  assert.equal(eq.kind, 'cylinder');
  assert.equal(onSheet(0, 0.7).turned, 0);
});

test('after a day north has turned past the swing by the sector, as the pendulum says', () => {
  for (const lat of [15, 34.1184, 48.8462, 70, -33.8688]) {
    const day = onSheet(lat, 1);
    close(Math.abs(day.turned), tangentCone(lat).sector, 1e-12, `sector at ${lat}`);
    // the pendulum's plane turns by Ωz over one sidereal day
    close(day.turned, localSpin(lat) * SIDEREAL_DAY, 1e-9, `pendulum at ${lat}`);
  }
});

test('on the sheet the angle from the swing to north is the angle turned so far', () => {
  for (const lat of [25, 48.8, -50]) {
    for (const f of [0, 0.1, 0.37, 0.5, 0.8]) {
      const s = onSheet(lat, f);
      close(Math.hypot(s.x, s.y), s.cone.slant, 1e-12, 'on the parallel');
      // north turns anticlockwise past the swing in the north, the swing clockwise
      const d = signedAngle(s.swing, s.north) - turnedAfter(lat, f);
      close(Math.atan2(Math.sin(d), Math.cos(d)), 0, 1e-9, `lat ${lat} f ${f}`);
    }
  }
});

test('half a day at 30° turns the swing a quarter turn', () => {
  close(turnedAfter(30, 0.5), Math.PI / 2, 1e-12);
  close(turnedAfter(-30, 0.5), -Math.PI / 2, 1e-12);
});
