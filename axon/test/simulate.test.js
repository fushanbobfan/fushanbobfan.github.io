import test from 'node:test';
import assert from 'node:assert/strict';
import { restBehaviour, membrane, simulate, spikeTimes, stimulusAt, summarize } from '../src/simulate.js';
import { SQUID } from '../src/hh.js';

const P = membrane();
const pulse = (amplitude, duration = 1, start = 5) => ({ start, duration, amplitude });
const run = (pulses, options) => summarize(simulate(P, pulses, options));

test('pulses add up and end when they should', () => {
  const pulses = [pulse(10), { start: 5.5, duration: 1, amplitude: 2 }];
  assert.equal(stimulusAt(pulses, 4.9), 0);
  assert.equal(stimulusAt(pulses, 5.2), 10);
  assert.equal(stimulusAt(pulses, 5.7), 12);
  assert.equal(stimulusAt(pulses, 6), 2);
  assert.equal(stimulusAt(pulses, 6.5), 0);
});

test('without a stimulus the squid membrane stays at -65 mV', () => {
  const s = run([]);
  assert.equal(s.spikes, 0);
  assert.ok(Math.abs(s.rest + 65) < 0.01);
  assert.ok(s.peak - s.trough < 0.001);
});

test('a brief push makes one spike that overshoots zero and undershoots rest', () => {
  const s = run([pulse(10)]);
  assert.equal(s.spikes, 1);
  assert.ok(s.peak > 35 && s.peak < 45, `peak ${s.peak}`);
  assert.ok(s.trough < -75, `trough ${s.trough}`);
  assert.ok(s.width > 1 && s.width < 1.3, `width ${s.width}`);
});

test('the spike does not depend on how finely it is sampled', () => {
  const coarse = run([pulse(10)], { samples: 1000 });
  const fine = run([pulse(10)], { samples: 4000 });
  assert.ok(Math.abs(coarse.times[0] - fine.times[0]) < 0.01);
});

test('threshold is all or nothing: 6.8 fails and 7 fires', () => {
  assert.equal(run([pulse(6.8)]).spikes, 0);
  const fired = run([pulse(7)]);
  assert.equal(fired.spikes, 1);
  assert.ok(fired.peak > 30);
});

test('a second push 8 ms later fails and one 15 ms later fires', () => {
  assert.equal(run([pulse(10), pulse(10, 1, 13)], { duration: 60 }).spikes, 1);
  assert.equal(run([pulse(10), pulse(10, 1, 20)], { duration: 60 }).spikes, 2);
});

test('steady current: 6 stops after two spikes, 6.5 and above keep firing, faster as it grows', () => {
  const steady = (a) => run([pulse(a, 1000)], { duration: 300, samples: 6000 });
  assert.equal(steady(6).spikes, 2);
  assert.ok(steady(6.5).spikes > 10);
  const rates = [6.5, 10, 20, 50].map((a) => steady(a).rate);
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] > rates[i - 1]);
  assert.ok(Math.abs(steady(10).rate - 68) < 1.5);
});

test('letting go of a hyperpolarizing current fires a spike after the release', () => {
  const trace = simulate(P, [pulse(-5, 30)], { duration: 60 });
  const s = summarize(trace);
  assert.equal(s.spikes, 1);
  assert.ok(s.times[0] > 35);
  const release = trace.t.findIndex((t) => t >= 35);
  assert.ok(trace.h[release] > trace.h[0], 'h has recovered');
  assert.ok(trace.n[release] < trace.n[0], 'n has fallen');
});

test('with no sodium channels the membrane only rises and falls with the push', () => {
  const trace = simulate(membrane({ naOpen: 0 }), [pulse(10)], {});
  const s = summarize(trace);
  assert.equal(s.spikes, 0);
  assert.ok(s.peak < -50);
});

test('half the potassium channels blocked: the membrane fires by itself with wider spikes', () => {
  const half = membrane({ kOpen: 0.5 });
  const b = restBehaviour(half);
  assert.equal(b.settled, false);
  const s = summarize(simulate(half, [], { duration: 100, samples: 2000 }));
  assert.ok(s.spikes >= 4);
  assert.ok(s.width > 1.3);
});

test('an unblocked membrane reports a settled rest, and full block leaves it depolarized', () => {
  const normal = restBehaviour(P);
  assert.equal(normal.settled, true);
  assert.ok(Math.abs(normal.v + 65) < 0.01);
  const none = restBehaviour(membrane({ kOpen: 0 }));
  assert.equal(none.settled, true);
  assert.ok(none.v > -5, `v ${none.v}`);
});

test('warming narrows the spike, and at 30 degrees the same push fails', () => {
  const at = (celsius) => run([pulse(20)], { celsius });
  const cold = at(SQUID.temperature);
  const warm = at(18.5);
  assert.ok(cold.width / warm.width > 3.5, `ratio ${cold.width / warm.width}`);
  assert.equal(at(30).spikes, 0);
});

test('spike times interpolate between samples', () => {
  const t = Float64Array.from([0, 1, 2]);
  const v = Float64Array.from([-10, 10, -5]);
  assert.deepEqual(spikeTimes({ t, v }), [0.5]);
});
