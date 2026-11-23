import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  poleX, leanAngle, photographPole, flashShare, flashProfile, flashCoverage, wholeFrameFlashExposure,
} from '../src/others.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('the pole stands at the centre halfway through the readout and moves at 2 / cross', () => {
  near(poleX(0, 101, 0.03, 0.3), -0.1);
  near(poleX(50, 101, 0.03, 0.3), 0);
  near(poleX(100, 101, 0.03, 0.3), 0.1);
});

test('the lean is the sideways move during the readout over the frame height', () => {
  near(leanAngle(0, 0.3), 0);
  // Crossing the frame in one readout moves the pole a full width down the frame: 45 degrees.
  near(leanAngle(0.03, 0.03), Math.PI / 4);
  near(leanAngle(0.03, 0.3), Math.atan(0.1));
});

test('the photographed pole leans by the predicted angle', () => {
  const size = 120;
  const readout = 0.03;
  const cross = 0.12;
  const photo = photographPole({ size, readout, cross });
  const centre = (row) => {
    let sum = 0;
    let w = 0;
    for (let col = 0; col < size; col++) {
      const dark = 223 - photo[(row * size + col) * 4];
      sum += dark * col;
      w += dark;
    }
    return sum / w;
  };
  const top = centre(0);
  const bottom = centre(size - 1);
  // Pixels: the pole moves right down the frame.
  assert.ok(bottom > top);
  const angle = Math.atan((bottom - top) / (size - 1));
  near(angle, leanAngle(readout, cross), 0.01);
  for (let i = 3; i < photo.length; i += 4) assert.equal(photo[i], 255);
});

test('a short flash lights a band as tall as the exposure plus the flash', () => {
  const rows = 1001;
  const opts = { readout: 0.03, exposure: 0.006, flashAt: 0.012, flash: 0.001 };
  const p = flashProfile(rows, opts);
  // A row opened well before the flash and still open after it catches all of it.
  near(flashShare(0, rows, { ...opts, flashAt: 0.002 }), 1);
  near(p[Math.round((0.010 / 0.03) * 1000)], 1);
  // A row that opens after the flash, or closes before it, catches none.
  near(p[Math.round((0.0135 / 0.03) * 1000)], 0);
  near(p[Math.round((0.004 / 0.03) * 1000)], 0);
  const cover = flashCoverage(rows, opts);
  near(cover.any, (0.006 + 0.001) / 0.03, 0.002);
  near(cover.full, (0.006 - 0.001) / 0.03, 0.002);
});

test('an exposure of the readout plus the flash lights the whole frame', () => {
  const rows = 400;
  const readout = 0.03;
  const flash = 0.001;
  const exposure = wholeFrameFlashExposure(readout, flash);
  near(exposure, 0.031);
  const cover = flashCoverage(rows, { readout, exposure, flashAt: readout, flash });
  assert.equal(cover.full, 1);
  const shorter = flashCoverage(rows, { readout, exposure: 0.02, flashAt: 0.015, flash });
  assert.ok(shorter.full < 1);
});

test('pole and flash readouts read naturally', async () => {
  const { crossLabel, leanLabel, flashLabel } = await import('../src/readout.js');
  assert.equal(crossLabel(0.3), '300 ms to cross the frame');
  assert.match(leanLabel(0.001), /^upright/);
  assert.equal(leanLabel(Math.atan(0.1)), 'leaning 5.7° from vertical, its foot further along than its top');
  assert.match(leanLabel(Math.PI / 4), /^leaning 45°/);
  assert.match(flashLabel({ full: 1, any: 1 }, 0.031, 0.03, 0.001), /whole frame is lit.*31 ms/);
  assert.match(flashLabel({ full: 0, any: 0 }, 0.005, 0.03, 0.001), /misses the frame/);
  assert.match(flashLabel({ full: 0.166, any: 0.233 }, 0.006, 0.03, 0.001), /17% of the rows catch all of it and 23% catch some/);
});
