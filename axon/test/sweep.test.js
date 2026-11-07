import test from 'node:test';
import assert from 'node:assert/strict';
import { currentSweep } from '../src/sweep.js';
import { membrane, simulate, summarize } from '../src/simulate.js';

const P = membrane();
const currents = (from, to, by) => {
  const list = [];
  for (let c = from; c <= to + 1e-9; c += by) list.push(c);
  return list;
};
const sweep = [...currentSweep(P, currents(5, 12, 0.25))];
const up = sweep.filter((p) => p.direction === 'up');
const down = sweep.filter((p) => p.direction === 'down');

test('a slow sweep up starts firing at the published 9.78', () => {
  const first = up.find((p) => p.rate > 0);
  assert.equal(first.current, 10);
  assert.equal(up.find((p) => p.current === 9.75).rate, 0);
});

// Near the end of the firing branch the two stable states have little room
// between them, so the last current to fire depends on the phase of the sweep.
test('a sweep back down keeps firing to just above the published 6.27', () => {
  const firing = down.filter((p) => p.rate > 0);
  const last = firing[firing.length - 1];
  assert.ok(last.current >= 6.25 && last.current <= 6.75, `last ${last.current}`);
  assert.equal(down.find((p) => p.current === 6).rate, 0);
});

test('firing starts abruptly, at more than 50 spikes a second', () => {
  const firing = down.filter((p) => p.rate > 0);
  assert.ok(firing[firing.length - 1].rate > 50);
});

test('between the two, the membrane remembers the way it came', () => {
  for (const current of [7, 8, 9]) {
    assert.equal(up.find((p) => p.current === current).rate, 0);
    assert.ok(down.find((p) => p.current === current).rate > 50);
  }
});

test('a sudden step to 8 fires on, where the slow approach stayed silent', () => {
  const s = summarize(simulate(P, [{ start: 5, duration: 1000, amplitude: 8 }], { duration: 300, samples: 6000 }));
  assert.ok(s.spikes > 10);
});

test('far above the range the swings no longer reach 0 mV, and at 200 they die out', () => {
  const [strong] = [...currentSweep(P, [100])];
  assert.equal(strong.rate, 0);
  const trace = simulate(P, [{ start: 0, duration: 1000, amplitude: 200 }], { duration: 300, samples: 3000 });
  const tail = [...trace.v.slice(-500)];
  assert.ok(Math.max(...tail) - Math.min(...tail) < 0.01);
  assert.ok(Math.abs(trace.v[trace.v.length - 1] + 40.8) < 0.5);
});
