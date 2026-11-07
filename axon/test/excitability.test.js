import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAPS, SPIKE_CONDUCTANCE, STRONGEST_SECOND_PULSE, WIDTHS, bisect, collect, pulseThreshold, recoveryCurve,
  rheobaseAndChronaxie, secondPulseThreshold, strengthDuration,
} from '../src/excitability.js';
import { membrane, simulate } from '../src/simulate.js';

const P = membrane();

test('bisection finds the edge and reports when the top fails', () => {
  assert.ok(Math.abs(bisect((x) => x >= 3.3, 0, 10, 0.001) - 3.3) < 0.002);
  assert.equal(bisect(() => false, 0, 10, 0.1), null);
});

test('the conductance test separates spikes from failures by a wide margin', () => {
  const peak = (pulses, from) => {
    const trace = simulate(P, pulses, { duration: 35, samples: 350 });
    let best = 0;
    trace.t.forEach((t, i) => {
      if (t >= from && trace.gNa[i] > best) best = trace.gNa[i];
    });
    return best;
  };
  const edge = pulseThreshold(P, 1);
  const pulse = (amplitude) => [{ start: 2, duration: 1, amplitude }];
  assert.ok(peak(pulse(edge - 0.05), 2) < 1);
  assert.ok(peak(pulse(edge + 0.05), 2) > 15);
});

test('the separation also holds for a second pulse on a recovering membrane', () => {
  const peakAfter = (gap, amplitude) => {
    const from = 2 + gap;
    const trace = simulate(P, [{ start: 2, duration: 1, amplitude: 15 }, { start: from, duration: 1, amplitude }], {
      duration: from + 25,
      samples: Math.round((from + 25) * 10),
    });
    let best = 0;
    trace.t.forEach((t, i) => {
      if (t >= from && trace.gNa[i] > best) best = trace.gNa[i];
    });
    return best;
  };
  for (const gap of [6, 7, 8, 12, 20]) {
    const edge = secondPulseThreshold(P, gap);
    assert.ok(peakAfter(gap, edge - 0.2) < 2, `gap ${gap} below: ${peakAfter(gap, edge - 0.2)}`);
    assert.ok(peakAfter(gap, edge + 0.2) > 6, `gap ${gap} above: ${peakAfter(gap, edge + 0.2)}`);
  }
});

test('a spike forced early in recovery is smaller than a normal one', () => {
  const peakAfter7Wide = () => {
    const trace = simulate(P, [
      { start: 2, duration: 1, amplitude: 15 },
      { start: 9, duration: 1, amplitude: secondPulseThreshold(P, 7) + 0.2 },
    ], { duration: 34, samples: 340 });
    let best = 0;
    trace.t.forEach((t, i) => {
      if (t >= 9 && trace.gNa[i] > best) best = trace.gNa[i];
    });
    return best;
  };
  const peakVoltage = (gap) => {
    const from = 2 + gap;
    const amplitude = secondPulseThreshold(P, gap) + 1;
    const trace = simulate(P, [{ start: 2, duration: 1, amplitude: 15 }, { start: from, duration: 1, amplitude }], {
      duration: from + 25,
      samples: Math.round((from + 25) * 10),
    });
    let best = -100;
    trace.t.forEach((t, i) => {
      if (t >= from + 1 && trace.v[i] > best) best = trace.v[i];
    });
    return best;
  };
  assert.ok(peakAfter7Wide() > 12, 'the jump is wide from 7 ms on');
  assert.ok(peakVoltage(7) < 20, `7 ms: ${peakVoltage(7)}`);
  assert.ok(peakVoltage(30) > 30, `30 ms: ${peakVoltage(30)}`);
});

test('a 1 ms pulse needs about 6.9', () => {
  assert.ok(Math.abs(pulseThreshold(P, 1) - 6.92) < 0.03);
});

test('threshold falls as pulses lengthen, down to a floor', () => {
  const points = collect(strengthDuration(P));
  assert.equal(points.length, WIDTHS.length);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].threshold <= points[i - 1].threshold + 0.02);
  const { rheobase, chronaxie } = rheobaseAndChronaxie(points);
  assert.ok(Math.abs(rheobase - 2.24) < 0.02, `rheobase ${rheobase}`);
  assert.ok(Math.abs(chronaxie - 1.66) < 0.1, `chronaxie ${chronaxie}`);
});

test('for short pulses it is the charge that counts', () => {
  const charges = collect(strengthDuration(P, [0.05, 0.1, 0.2, 0.3])).map((p) => p.width * p.threshold);
  for (const q of charges) assert.ok(Math.abs(q - 6.5) < 0.2, `charge ${q}`);
});

test('recovery: impossible at first, then hard, then below normal, then back', () => {
  assert.equal(GAPS[0], 4);
  assert.equal(secondPulseThreshold(P, 4), null);
  assert.equal(secondPulseThreshold(P, 5), null);
  const at = (gap) => secondPulseThreshold(P, gap);
  const resting = pulseThreshold(P, 1);
  const sixMs = at(6);
  assert.ok(sixMs > 100 && sixMs < STRONGEST_SECOND_PULSE);
  assert.ok(at(10) > 3 * resting);
  assert.ok(at(19) < resting - 0.5, 'supernormal around 19 ms');
  assert.ok(Math.abs(at(60) - resting) < 0.2, 'back to normal');
});

test('the curve reports each gap', () => {
  const points = collect(recoveryCurve(P, [4, 20]));
  assert.deepEqual(points.map((p) => p.gap), [4, 20]);
  assert.equal(points[0].threshold, null);
  assert.ok(points[1].threshold > 0);
});
