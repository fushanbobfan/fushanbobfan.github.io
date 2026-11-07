import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, firePulse, makeCable, measureSpeed } from '../src/cable.js';

const SQUID_AXON = { diameter: 476, count: 240, dx: 0.05, celsius: 18.5 };

function crossings(cable, time, fire) {
  fire(cable);
  const seen = new Int32Array(cable.count);
  const last = Float64Array.from(cable.v);
  while (cable.time < time) {
    advance(cable, 0.01);
    for (let i = 0; i < cable.count; i++) {
      if (last[i] < 0 && cable.v[i] >= 0) seen[i]++;
      last[i] = cable.v[i];
    }
  }
  return seen;
}

test('an unstimulated cable does not move', () => {
  const cable = makeCable(SQUID_AXON);
  for (let i = 0; i < 2000; i++) advance(cable, 0.01);
  for (const v of cable.v) assert.ok(Math.abs(v + 65) < 0.01, `v ${v}`);
});

test('the spike runs at the speed Hodgkin and Huxley calculated', () => {
  const speed = measureSpeed({ ...SQUID_AXON, count: 480, dx: 0.025 }, { dt: 0.005 });
  assert.ok(Math.abs(speed - 18.8) < 0.15, `speed ${speed}`);
  assert.equal(measureSpeed(SQUID_AXON).toFixed(1), '18.7', 'the figure the page quotes');
});

test('the speed converges as the grid is refined', () => {
  const at = (factor) => measureSpeed({ ...SQUID_AXON, count: 240 * factor, dx: 0.05 / factor }, { dt: 0.01 / factor });
  const coarse = Math.abs(at(1) - at(4));
  const fine = Math.abs(at(2) - at(4));
  assert.ok(fine < coarse / 3, `coarse ${coarse} fine ${fine}`);
  assert.ok(coarse < 0.1);
});

test('four times the diameter gives twice the speed', () => {
  const at = (diameter) => measureSpeed({
    diameter, count: 240, dx: 0.05 * Math.sqrt(diameter / 476), celsius: 18.5,
  });
  const ratio = at(400) / at(100);
  assert.ok(Math.abs(ratio - 2) < 0.02, `ratio ${ratio}`);
});

test('warming speeds it up, then the spike shrinks and fails between 33 and 34 degrees', () => {
  const at = (celsius) => measureSpeed({ ...SQUID_AXON, celsius }, { dt: 0.002 });
  assert.ok(at(25) > at(18.5));
  assert.ok(at(18.5) > at(6.3));
  assert.ok(at(33) > 0);
  assert.equal(at(34), null);
});

test('a spike from one end visits every patch once and leaves rest behind it', () => {
  const cable = makeCable(SQUID_AXON);
  const seen = crossings(cable, 12, (c) => firePulse(c, 5));
  assert.ok(seen.every((count) => count === 1));
});

test('a spike from the middle runs both ways', () => {
  const cable = makeCable(SQUID_AXON);
  const seen = crossings(cable, 10, (c) => firePulse(c, 120));
  assert.equal(seen[20], 1);
  assert.equal(seen[220], 1);
});

test('two spikes meeting head on vanish and do not pass through', () => {
  const cable = makeCable(SQUID_AXON);
  const seen = crossings(cable, 14, (c) => {
    firePulse(c, 5);
    firePulse(c, c.count - 6);
  });
  assert.ok(seen.every((count) => count === 1), 'each patch fired once only');
  assert.ok(Math.max(...cable.v) < -50, 'nothing left running');
});

test('a pulse is removed once it ends', () => {
  const cable = makeCable(SQUID_AXON);
  firePulse(cable, 10, { duration: 0.1 });
  for (let i = 0; i < 20; i++) advance(cable, 0.01);
  assert.equal(cable.pulses.length, 0);
});
