import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, PRESETS, presetSettings, pulsesFrom } from '../src/presets.js';
import { membrane, restBehaviour, simulate, summarize } from '../src/simulate.js';
import { temperatureFactor } from '../src/hh.js';

function outcome(settings) {
  return summarize(simulate(
    membrane({ naOpen: settings.na / 100, kOpen: settings.k / 100 }),
    pulsesFrom(settings),
    { duration: settings.length, samples: 3000, celsius: settings.celsius },
  ));
}
const at = (id, changes = {}) => outcome({ ...presetSettings(id), ...changes });

test('every preset has a label and a note, and unique ids', () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  for (const p of PRESETS) {
    assert.ok(p.label && p.note);
    assert.ok(presetSettings(p.id));
  }
  assert.equal(presetSettings('nope'), null);
});

test('a brief push: peak about +39 and trough about -76', () => {
  const s = at('push');
  assert.equal(s.spikes, 1);
  assert.ok(Math.abs(s.peak - 39) < 1);
  assert.ok(Math.abs(s.trough + 76) < 1);
});

test('just too weak: 6.8 fails, 7 fires near full height', () => {
  assert.equal(at('short').spikes, 0);
  const s = at('short', { amplitude: 7 });
  assert.equal(s.spikes, 1);
  assert.ok(s.peak > 0.85 * at('push').peak);
});

test('second push: nothing at 8 ms, a spike at 15 ms', () => {
  assert.equal(at('soon').spikes, 1);
  assert.equal(at('soon', { gap: 15 }).spikes, 2);
});

test('at the second push more sodium channels are plugged and more potassium open than at rest', () => {
  const s = presetSettings('soon');
  const trace = simulate(membrane(), pulsesFrom(s), { duration: 60, samples: 3000 });
  const i = trace.t.findIndex((t) => t >= 5 + s.gap);
  assert.ok(trace.h[i] < 0.7 * trace.h[0], `h ${trace.h[i]}`);
  assert.ok(trace.n[i] > 1.3 * trace.n[0], `n ${trace.n[i]}`);
});

test('steady current: about 68 a second, faster when stronger, two spikes at 6', () => {
  const s = at('steady');
  assert.ok(s.spikes >= 6);
  assert.ok(Math.abs(s.rate - 68) < 1.5, `rate ${s.rate}`);
  assert.ok(at('steady', { amplitude: 20 }).rate > s.rate);
  assert.equal(at('steady', { amplitude: 6 }).spikes, 2);
});

test('letting go fires after the current stops', () => {
  const s = at('rebound');
  assert.equal(s.spikes, 1);
  assert.ok(s.times[0] > 35);
});

test('sodium blocked: no spike', () => {
  assert.equal(at('no-sodium').spikes, 0);
});

test('half the potassium blocked: fires with no pulses, spikes wider', () => {
  const settings = presetSettings('low-potassium');
  assert.deepEqual(pulsesFrom(settings), []);
  assert.equal(restBehaviour(membrane({ kOpen: 0.5 })).settled, false);
  const s = outcome(settings);
  assert.ok(s.spikes >= 4);
  assert.ok(s.width > at('push').width);
});

test('warm: 3.8 times faster, spike about four times narrower, and no spike at 30', () => {
  assert.ok(Math.abs(temperatureFactor(18.5) - 3.8) < 0.05);
  const cold = at('warm', { celsius: 6.3 });
  const warm = at('warm');
  assert.ok(Math.abs(cold.width / warm.width - 4) < 0.3, `ratio ${cold.width / warm.width}`);
  assert.equal(at('warm', { celsius: 30 }).spikes, 0);
});

test('at 30 degrees potassium catches up: n rises while the voltage is still below 0', () => {
  const s = presetSettings('warm');
  const trace = simulate(membrane(), pulsesFrom(s), { duration: 20, samples: 2000, celsius: 30 });
  const peakIndex = trace.v.indexOf(Math.max(...trace.v));
  const iK = trace.iK[peakIndex];
  const iNa = -trace.iNa[peakIndex];
  assert.ok(iK + trace.iL[peakIndex] >= iNa - 3, 'outward balances inward at the peak');
  assert.ok(trace.n[peakIndex] > trace.n[0] + 0.1);
});

test('the controls build the pulses they describe', () => {
  assert.deepEqual(pulsesFrom(DEFAULTS), [{ start: 5, duration: 1, amplitude: 10 }]);
  assert.equal(pulsesFrom({ ...DEFAULTS, amplitude: 0 }).length, 0);
  const pair = pulsesFrom({ ...DEFAULTS, second: true, gap: 8, secondAmplitude: 3 });
  assert.deepEqual(pair[1], { start: 13, duration: 1, amplitude: 3 });
});
