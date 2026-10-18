import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machAngle, dopplerRatio, approaching, receding } from '../src/doppler.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('the Mach angle is undefined below Mach 1 and 30 degrees at Mach 2', () => {
  assert.equal(machAngle(0.8), null);
  assert.equal(machAngle(1), null);
  close(machAngle(2), Math.PI / 6);
  close(Math.sin(machAngle(1.4)), 1 / 1.4);
});

test('straight ahead and straight behind give the textbook shifts', () => {
  const c = 25;
  close(dopplerRatio(10, 0, 1, 0, c), approaching(0.4));
  close(dopplerRatio(10, 0, -1, 0, c), receding(0.4));
  close(approaching(0.5), 2);
  close(receding(1), 0.5);
});

test('sound sent at right angles to the motion is not shifted', () => {
  close(dopplerRatio(10, 0, 0, 1, 25), 1);
});

test('ahead of a supersonic source the ratio turns negative', () => {
  assert.ok(dopplerRatio(50, 0, 1, 0, 25) < 0);
  assert.ok(dopplerRatio(50, 0, -1, 0, 25) > 0);
});

test('wind alone shifts nothing for a source and listener at rest', () => {
  close(dopplerRatio(0, 0, 1, 0, 25, { x: 10, y: 0 }), 1);
  close(dopplerRatio(0, 0, -1, 0, 25, { x: 10, y: 0 }), 1);
});

test('a moving source in a wind follows (c + w) / (c + w - v)', () => {
  close(dopplerRatio(10, 0, 1, 0, 25, { x: 5, y: 0 }), 30 / 20);
  close(dopplerRatio(10, 0, -1, 0, 25, { x: 5, y: 0 }), 20 / 30);
});

test('a listener walking towards the sound hears it higher', () => {
  // Sound travelling in +x, listener moving in -x at 5.
  close(dopplerRatio(0, 0, 1, 0, 25, undefined, { x: -5, y: 0 }), 30 / 25);
  // Moving with the source at the same speed cancels the shift.
  close(dopplerRatio(10, 0, 1, 0, 25, undefined, { x: 10, y: 0 }), 1);
});

import { History } from '../src/history.js';
import { images } from '../src/doppler.js';

// A source on the x axis moving right at speed v, sampled every dt up to time t.
function lineTrack(v, t, dt = 0.01, span = 30) {
  const h = new History(span);
  for (let k = 0; k * dt <= t + 1e-12; k++) {
    const s = k * dt;
    h.push(s, -200 + v * s, 0, v, 0);
  }
  return h;
}

test('below Mach 1 there is exactly one image, at the retarded time', () => {
  const c = 25;
  const v = 10;
  const t = 20;
  const h = lineTrack(v, t);
  const L = { x: 0, y: 30 };
  const found = images(h, L.x, L.y, t, c);
  assert.equal(found.length, 1);
  const [im] = found;
  close(Math.hypot(L.x - im.x, L.y - im.y), c * (t - im.tau), 1e-6);
  const ux = (L.x - im.x) / im.dist;
  close(im.ratio, 1 / (1 - (v * ux) / c), 1e-9);
  assert.equal(im.reversed, false);
});

test('the image ratio falls from 1/(1-M) to 1/(1+M) as the source goes by', () => {
  const c = 25;
  const v = 10;
  const h = lineTrack(v, 40, 0.01, 60);
  const early = images(lineTrack(v, 12, 0.01, 60), 0, 2, 12, c)[0];
  const late = images(h, 0, 2, 40, c)[0];
  close(early.ratio, 1 / (1 - 0.4), 1e-3);
  close(late.ratio, 1 / (1 + 0.4), 1e-3);
});

test('outside the Mach cone a supersonic source is silent', () => {
  const c = 25;
  const v = 50;
  const t = 3;
  const h = lineTrack(v, t);
  // The source is at x = -50; a listener well ahead of it hears nothing.
  assert.equal(images(h, 50, 20, t, c).length, 0);
});

test('inside the cone two images arrive, the approach one reversed', () => {
  const c = 25;
  const v = 50;
  const t = 8;
  const h = lineTrack(v, t);
  // The source is at x = 200, long past a listener near the origin.
  const found = images(h, 0, 20, t, c);
  assert.equal(found.length, 2);
  const reversed = found.filter((im) => im.reversed);
  assert.equal(reversed.length, 1);
  for (const im of found) close(im.dist, c * (t - im.tau), 1e-6);
});

test('the cone edge sits at the Mach angle behind the source', () => {
  const c = 25;
  const v = 50;
  const t = 8;
  const h = lineTrack(v, t);
  const sx = -200 + v * t;
  const mu = machAngle(2);
  // Points just inside and just outside the cone at the same distance back.
  const back = 100;
  const edge = back * Math.tan(mu);
  assert.equal(images(h, sx - back, edge * 0.97, t, c).length, 2);
  assert.equal(images(h, sx - back, edge * 1.03, t, c).length, 0);
});

test('sound never crosses a break in the track', () => {
  const h = new History(30);
  for (let k = 0; k <= 100; k++) h.push(k * 0.1, k < 50 ? 0 : 1000, 0, 0, 0, k === 50);
  // A listener 100 units from the first stretch, heard at t = 10, should get
  // the first stretch at tau = 6 only if that piece covers it; it does not
  // (it ends at 4.9), and the jump itself must not create a root.
  const found = images(h, 0, 100, 10, 25);
  for (const im of found) assert.ok(im.x === 1000 || im.tau < 5);
  assert.ok(found.every((im) => Math.abs(im.dist - 25 * (10 - im.tau)) < 1e-6));
});

test('in a wind the arriving ring is the one the air has carried to the listener', () => {
  const c = 25;
  const v = 10;
  const t = 20;
  const wind = { x: -6, y: 3 };
  const h = lineTrack(v, t);
  const found = images(h, 0, 30, t, c, { wind });
  assert.equal(found.length, 1);
  const [im] = found;
  const age = t - im.tau;
  close(Math.hypot(0 - im.x - wind.x * age, 30 - im.y - wind.y * age), c * age, 1e-6);
  close(im.dist, c * age, 1e-6);
});

test('a still source heard in a wind keeps its pitch', () => {
  const h = new History(30);
  for (let k = 0; k <= 1000; k++) h.push(k * 0.01, 0, 0, 0, 0);
  const [im] = images(h, 40, 10, 10, 25, { wind: { x: 8, y: 0 } });
  close(im.ratio, 1, 1e-12);
});

test('a listener chasing a receding source at the same speed hears no shift', () => {
  const v = 10;
  const h = lineTrack(v, 20);
  const sx = -200 + v * 20;
  const [im] = images(h, sx - 50, 0, 20, 25, { obs: { x: v, y: 0 } });
  close(im.ratio, 1, 1e-9);
});
