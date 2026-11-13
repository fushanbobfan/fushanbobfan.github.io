import test from 'node:test';
import assert from 'node:assert/strict';
import { partials, amplitudeSum, modeAmplitudes, createVoice, BASE_HZ, MAX_HZ } from '../src/sound.js';
import { createString, step, modeEnergies, pluckShape, modeOnly } from '../src/model.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('the lowest mode sounds at the base pitch and the rest keep their true ratios', () => {
  const s = createString(12, undefined, pluckShape(12, 3, 0.6));
  const e = modeEnergies(s);
  const list = partials(e, s.omega, amplitudeSum(e, s.omega));
  close(list[0].hz, BASE_HZ, 1e-9);
  for (let k = 2; k <= 12; k++) close(list[k - 1].hz, (BASE_HZ * s.omega[k - 1]) / s.omega[0], 1e-9);
  assert.ok(list[1].hz < 2 * BASE_HZ, 'beads flatten the first overtone');
});

test('the smooth-string option tunes mode k to k times the base', () => {
  const s = createString(6, undefined, pluckShape(6, 2, 0.6));
  const e = modeEnergies(s);
  partials(e, s.omega, amplitudeSum(e, s.omega), { smooth: true })
    .forEach((p, i) => close(p.hz, BASE_HZ * (i + 1), 1e-9));
});

test('levels follow the mode amplitudes and add up to one at the reference moment', () => {
  const s = createString(10, undefined, pluckShape(10, 4, 0.6));
  const e = modeEnergies(s);
  const norm = amplitudeSum(e, s.omega);
  const list = partials(e, s.omega, norm);
  close(list.reduce((a, p) => a + p.gain, 0), 1, 1e-12);
  const amps = modeAmplitudes(e, s.omega);
  list.forEach((p, i) => close(p.gain, amps[i] / norm, 1e-15));
});

test('a single mode is a single tone', () => {
  const s = createString(8, undefined, modeOnly(8, 3, 0.5));
  const e = modeEnergies(s);
  const list = partials(e, s.omega, amplitudeSum(e, s.omega));
  list.forEach((p, i) => (i === 2 ? close(p.gain, 1, 1e-9) : assert.ok(p.gain < 1e-9)));
});

test('a damped string fades against a fixed reference', () => {
  const params = { coupling: 1, anchor: 0, damping: 0.1 };
  const s = createString(12, params, pluckShape(12, 3, 0.6));
  const e0 = modeEnergies(s);
  const norm = amplitudeSum(e0, s.omega);
  step(s, 30);
  const e = modeEnergies(s);
  const total = partials(e, s.omega, norm).reduce((a, p) => a + p.gain, 0);
  assert.ok(total < Math.exp(-0.05 * 30) * 1.6 && total > 0, `${total}`);
});

test('silence where there is no pitch', () => {
  const still = partials([0, 0], [0, 0], 0);
  still.forEach((p) => assert.equal(p.gain, 0));
  // A pitch above the limit is muted rather than played.
  const high = partials([1, 1], [1, 100], 1);
  assert.ok(high[1].hz > MAX_HZ);
  assert.equal(high[1].gain, 0);
  assert.ok(high[0].gain > 0);
});

// A minimal stand-in for the Web Audio API that records what is set.
class FakeParam {
  constructor() { this.value = 0; this.targets = []; }
  setTargetAtTime(v) { this.value = v; this.targets.push(v); }
}
class FakeNode {
  constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); this.started = false; }
  connect(n) { return n; }
  start() { this.started = true; }
}
class FakeContext {
  constructor() { this.currentTime = 0; this.destination = new FakeNode(); this.nodes = []; this.resumed = false; }
  createGain() { const n = new FakeNode(); this.nodes.push(n); return n; }
  createOscillator() { const n = new FakeNode(); this.nodes.push(n); return n; }
  async resume() { this.resumed = true; }
}

test('the voice grows tones on demand and silences the ones no longer used', async () => {
  let ctx;
  const voice = createVoice(class extends FakeContext { constructor() { super(); ctx = this; } });
  await voice.on();
  assert.ok(ctx.resumed);
  voice.set([{ hz: 196, gain: 0.5 }, { hz: 390, gain: 0.25 }, { hz: 580, gain: 0.1 }]);
  const oscs = ctx.nodes.filter((n) => n.started);
  assert.equal(oscs.length, 3);
  assert.equal(oscs[1].frequency.value, 390);
  voice.set([{ hz: 196, gain: 0.4 }]);
  assert.equal(ctx.nodes.filter((n) => n.started).length, 3, 'no new tones for fewer modes');
  const gains = ctx.nodes.filter((n) => !n.started).slice(1);
  assert.deepEqual(gains.map((g) => g.gain.value), [0.4, 0, 0]);
  voice.off();
  assert.equal(ctx.nodes[0].gain.value, 0);
  assert.equal(createVoice(undefined), null);
});

test('with four beads the first overtone is 87 cents flat of the octave', async () => {
  const { modeFrequency } = await import('../src/model.js');
  const cents = 1200 * Math.log2(2 / (modeFrequency(4, 2) / modeFrequency(4, 1)));
  assert.equal(Math.round(cents), 87);
});
