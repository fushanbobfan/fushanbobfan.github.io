import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProp } from '../src/shutter.js';
import { frameTurn, apparentTurn, apparentRpm, standstillRpms, maxReadout, motionVerdict } from '../src/video.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('the turn between frames follows speed, frame rate and direction', () => {
  near(frameTurn(makeProp({ rpm: 1800 }), 30), 360);
  near(frameTurn(makeProp({ rpm: 1800, direction: -1 }), 60), -180);
  near(frameTurn(makeProp({ rpm: 0 }), 24), 0);
});

test('a three-blade propeller at one blade spacing per frame seems to stand still', () => {
  // 600 rpm = 10 turns a second; at 30 fps that is 120 degrees a frame.
  const p = makeProp({ rpm: 600, blades: 3 });
  near(frameTurn(p, 30), 120);
  assert.equal(apparentTurn(p, 30), 0);
  assert.equal(apparentRpm(p, 30), 0);
  assert.match(motionVerdict(p, 30), /hang still/);
});

test('just under a blade spacing per frame looks like slow backward turning', () => {
  const p = makeProp({ rpm: 590, blades: 3 });
  near(apparentTurn(p, 30), 118 - 120);
  near(apparentRpm(p, 30), -10);
  assert.match(motionVerdict(p, 30), /creep backwards/);
  const q = makeProp({ rpm: 610, blades: 3 });
  near(apparentRpm(q, 30), 10);
  assert.match(motionVerdict(q, 30), /creeps forwards/);
});

test('the seen turn always lies within half a blade spacing and matches the real turn modulo a spacing', () => {
  for (const blades of [1, 2, 3, 5, 8]) {
    for (const fps of [24, 30, 60]) {
      for (let rpm = 0; rpm <= 9000; rpm += 37) {
        for (const direction of [1, -1]) {
          const p = makeProp({ rpm, blades, direction });
          const seen = apparentTurn(p, fps);
          const spacing = 360 / blades;
          assert.ok(seen > -spacing / 2 - 1e-9 && seen <= spacing / 2 + 1e-9);
          const k = (frameTurn(p, fps) - seen) / spacing;
          near(k, Math.round(k), 1e-6);
        }
      }
    }
  }
});

test('slow propellers look the way they turn', () => {
  const p = makeProp({ rpm: 120, blades: 2 });
  near(apparentRpm(p, 30), 120);
  assert.match(motionVerdict(p, 30), /true motion/);
  assert.match(motionVerdict(makeProp({ rpm: 0 }), 30), /standing still/);
});

test('standstill speeds are whole multiples of fps x 60 / blades', () => {
  assert.deepEqual(standstillRpms(3, 30, 2000), [600, 1200, 1800]);
  assert.deepEqual(standstillRpms(2, 24, 3000), [720, 1440, 2160, 2880]);
  for (const rpm of standstillRpms(5, 25, 9000)) assert.equal(apparentTurn(makeProp({ rpm, blades: 5 }), 25), 0);
  near(maxReadout(30), 1 / 30);
});

test('video readouts name the frame rate, the turn, the seen motion and the readout used', async () => {
  const { videoRows, nearestStandstill, playbackLabel } = await import('../src/readout.js');
  const r = videoRows(makeProp({ rpm: 590, blades: 3 }), 0.03, 30);
  assert.deepEqual(r.map(([k]) => k), ['Frame rate', 'Turn between frames', 'Seen on video', 'Readout in each frame']);
  assert.equal(r[0][1], '30 frames a second');
  assert.equal(r[1][1], '118°');
  assert.equal(r[2][1], '10 rpm backwards');
  assert.equal(r[3][1], '30 ms from top to bottom');
  assert.equal(videoRows(makeProp({ rpm: 600, blades: 3 }), 0.03, 30)[2][1], 'standing still');
  assert.equal(videoRows(makeProp({ rpm: 610, blades: 3, direction: -1 }), 0.03, 30)[2][1], '10 rpm forwards');
  assert.match(videoRows(makeProp({ rpm: 600 }), 0.03, 60)[3][1], /^16\.7 ms, a whole frame/);
  assert.equal(nearestStandstill(1000, 3, 30, 9000), 1200);
  assert.equal(nearestStandstill(100, 3, 30, 9000), 600);
  assert.equal(nearestStandstill(100, 1, 240, 9000), null);
  assert.equal(playbackLabel(24), 'played at its own 24 frames a second');
  assert.equal(playbackLabel(60), 'played at 30 frames a second, 2 times slower than life');
  assert.equal(playbackLabel(25), 'played at its own 25 frames a second');
  assert.equal(playbackLabel(50), 'played at 30 frames a second, 1.7 times slower than life');
});

test('exactly half a blade spacing per frame is called ambiguous', async () => {
  // 2,700 rpm with two blades at 60 fps: 270 degrees a frame, 90 past a spacing of 180.
  const p = makeProp({ rpm: 2700, blades: 2 });
  near(Math.abs(apparentTurn(p, 60)), 90);
  assert.match(motionVerdict(p, 60), /ambiguous/);
  const { videoRows } = await import('../src/readout.js');
  assert.equal(videoRows(p, 0.01, 60)[2][1], '900 rpm, direction ambiguous');
  // Below half a spacing the verdict is about true motion, not ambiguity.
  assert.match(motionVerdict(makeProp({ rpm: 899, blades: 2 }), 60), /true motion/);
});
