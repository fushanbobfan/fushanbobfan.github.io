import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeProp, bladeAngle, rowTime, turnDuringReadout, onBlade, pixelToScene,
  photograph, exposeRows, coverage, bladePolygons, HUB, EXTENT,
} from '../src/shutter.js';

const SIZE = 64;

function same(a, b) {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

test('the top row is read at once and the bottom row a full readout later', () => {
  assert.equal(rowTime(0, 100, 0.03), 0);
  assert.equal(rowTime(99, 100, 0.03), 0.03);
  assert.ok(Math.abs(rowTime(33, 100, 0.03) - 0.01) < 1e-12);
  assert.equal(rowTime(0, 1, 0.03), 0);
});

test('3000 rpm turns the propeller one and a half times in a 30 ms readout', () => {
  const p = makeProp({ rpm: 3000 });
  assert.ok(Math.abs(turnDuringReadout(p, 0.03) - 540) < 1e-9);
  assert.ok(Math.abs(bladeAngle(p, 0.02) - bladeAngle(p, 0) - 2 * Math.PI) < 1e-12);
  const back = makeProp({ rpm: 3000, direction: -1 });
  assert.ok(Math.abs(bladeAngle(back, 0.005) - bladeAngle(back, 0) + Math.PI / 2) < 1e-12);
});

test('a point is on a blade along its axis, off it beside the blade, and always on the hub', () => {
  const p = makeProp({ blades: 3, width: 0.05 });
  assert.ok(onBlade(p, 0.6, 0, 0));
  assert.ok(onBlade(p, 0.6, 0.049, 0));
  assert.ok(!onBlade(p, 0.6, 0.06, 0));
  assert.ok(!onBlade(p, 1.01, 0, 0));
  assert.ok(onBlade(p, 0.05, -0.05, 1.234));
  // The other two blades of three, at 120 and 240 degrees.
  assert.ok(onBlade(p, 0.5 * Math.cos(2.0944), 0.5 * Math.sin(2.0944), 0));
  assert.ok(onBlade(p, 0.5 * Math.cos(4.1888), 0.5 * Math.sin(4.1888), 0));
  assert.ok(!onBlade(p, -0.6, 0, 0));
  // A single blade has nothing on its back side.
  const one = makeProp({ blades: 1, width: 0.05 });
  assert.ok(!onBlade(one, -0.6, 0, 0));
  assert.ok(onBlade(one, 0.6, 0, 0));
});

test('pixel centres span the sensor symmetrically', () => {
  const a = pixelToScene(0, 0, SIZE);
  const b = pixelToScene(SIZE - 1, SIZE - 1, SIZE);
  assert.ok(Math.abs(a.x + b.x) < 1e-12 && Math.abs(a.y + b.y) < 1e-12);
  assert.ok(a.x < -EXTENT + 0.05 && a.y > EXTENT - 0.05);
});

test('a still propeller, or a sensor read all at once, gives the same picture as a snapshot', () => {
  const still = makeProp({ rpm: 0, phase: 0.7 });
  const spun = makeProp({ rpm: 4000, phase: 0.7 });
  const snapshot = photograph(still, { size: SIZE, readout: 0 });
  assert.ok(same(photograph(still, { size: SIZE, readout: 0.03 }), snapshot));
  assert.ok(same(photograph(spun, { size: SIZE, readout: 0 }), snapshot));
  // A fast propeller read row by row does not.
  assert.ok(!same(photograph(spun, { size: SIZE, readout: 0.03 }), snapshot));
});

test('every row of the photo is the scene as it stood when that row was read', () => {
  const p = makeProp({ rpm: 2500, blades: 4, phase: 0.3 });
  const readout = 0.025;
  const start = 0.004;
  const photo = photograph(p, { size: SIZE, readout, start });
  for (const row of [0, 11, 31, 47, 63]) {
    const angle = bladeAngle(p, start + rowTime(row, SIZE, readout));
    for (let col = 0; col < SIZE; col++) {
      const c = coverage(p, col, row, SIZE, angle);
      const k = (row * SIZE + col) * 4;
      // Sky is lighter than blade; full coverage is the darkest value.
      if (c === 1) assert.equal(photo[k], 43);
      if (c === 0) assert.equal(photo[k], 223);
    }
  }
});

test('exposing the rows in pieces gives the same photo as exposing them at once', () => {
  const p = makeProp({ rpm: 5000, blades: 2 });
  const opts = { size: SIZE, readout: 0.03, start: 0.001 };
  const whole = photograph(p, opts);
  const pieces = new Uint8ClampedArray(SIZE * SIZE * 4);
  exposeRows(p, opts, 0, 20, pieces);
  exposeRows(p, opts, 20, 21, pieces);
  exposeRows(p, opts, 21, SIZE, pieces);
  assert.ok(same(whole, pieces));
});

test('turning the other way gives the mirror image', () => {
  const size = 48;
  const cw = photograph(makeProp({ rpm: 3000, direction: 1, phase: 0.4 }), { size, readout: 0.03 });
  const ccw = photograph(makeProp({ rpm: 3000, direction: -1, phase: Math.PI - 0.4 }), { size, readout: 0.03 });
  let differ = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const a = cw[(row * size + col) * 4];
      const b = ccw[(row * size + (size - 1 - col)) * 4];
      if (Math.abs(a - b) > 1) differ++;
    }
  }
  assert.equal(differ, 0);
});

test('blade outlines start at the hub and end at the tips', () => {
  const p = makeProp({ blades: 5, width: 0.06 });
  const polys = bladePolygons(p, 0.2);
  assert.equal(polys.length, 5);
  for (const poly of polys) {
    const r = poly.map((q) => Math.hypot(q.x, q.y));
    assert.ok(Math.abs(r[0] - HUB) < 1e-9 && Math.abs(r[1] - 1) < 1e-9);
    // Corners lie on the blade.
    const mid = { x: (poly[0].x + poly[1].x + poly[2].x + poly[3].x) / 4, y: (poly[0].y + poly[1].y + poly[2].y + poly[3].y) / 4 };
    assert.ok(onBlade(p, mid.x, mid.y, 0.2));
  }
});
