import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEMS, defaultParams } from '../src/systems.js';
import { distinctLevels } from '../src/integrate.js';
import { createSweep, maximaRange } from '../src/bifurcation.js';

const rossler = SYSTEMS.rossler;

function levelsAt(results, value) {
  const r = results.reduce((best, x) => (Math.abs(x.value - value) < Math.abs(best.value - value) ? x : best));
  return distinctLevels(r.maxima, 1e-2).length;
}

test('columns are spread evenly across the requested range', () => {
  const sweep = createSweep(rossler, defaultParams('rossler'), { key: 'c', from: 2, to: 6, columns: 5, transientTime: 10, sampleTime: 10 });
  sweep.advance();
  assert.ok(sweep.done);
  assert.deepEqual(sweep.results.map((r) => r.value), [2, 3, 4, 5, 6]);
  assert.equal(sweep.valueAt(0.25), 3);
  assert.equal(sweep.valueAt(2), 6);
});

test('the Rossler sweep shows the period-doubling cascade', () => {
  const sweep = createSweep(rossler, defaultParams('rossler'), {
    key: 'c',
    from: 2.5,
    to: 5.7,
    columns: 33,
    transientTime: 400,
    sampleTime: 300,
  });
  sweep.advance();
  assert.equal(levelsAt(sweep.results, 2.5), 1);
  assert.equal(levelsAt(sweep.results, 3.5), 2);
  assert.equal(levelsAt(sweep.results, 4.0), 4);
  assert.ok(levelsAt(sweep.results, 5.7) > 10);
});

test('work can be split across calls without changing the result', () => {
  const opts = { key: 'c', from: 3, to: 5, columns: 6, transientTime: 50, sampleTime: 50 };
  const whole = createSweep(rossler, defaultParams('rossler'), opts);
  whole.advance();
  const parts = createSweep(rossler, defaultParams('rossler'), opts);
  while (!parts.done) assert.equal(parts.advance(Infinity, 2), 2);
  assert.deepEqual(parts.results, whole.results);
});

test('a time budget stops after the column that used it up', () => {
  let t = 0;
  const sweep = createSweep(rossler, defaultParams('rossler'), { key: 'c', columns: 10, transientTime: 5, sampleTime: 5 });
  const n = sweep.advance(3, Infinity, () => (t += 1));
  // The fake clock ticks once per read: start at 1, then 2, 3, 4 after each column.
  assert.equal(n, 3);
  assert.equal(sweep.results.length, 3);
});

test('a stable equilibrium leaves empty columns and escapes are marked', () => {
  const lorenz = SYSTEMS.lorenz;
  const sweep = createSweep(lorenz, defaultParams('lorenz'), { key: 'rho', from: 10, to: 15, columns: 2, transientTime: 100, sampleTime: 50 });
  sweep.advance();
  for (const r of sweep.results) assert.equal(r.maxima.length, 0);
  const runaway = {
    params: [{ key: 'k', min: 1, max: 2 }],
    start: [1, 0, 0],
    dt: 0.01,
    field: (p, s, out) => {
      out[0] = p.k * s[0] * s[0];
      out[1] = 0;
      out[2] = 0;
    },
  };
  const e = createSweep(runaway, { k: 1 }, { key: 'k', columns: 2, transientTime: 5, sampleTime: 5, axis: 0 });
  e.advance();
  assert.ok(e.results.every((r) => r.escaped));
});

test('unknown parameters are refused and the maxima range spans every column', () => {
  assert.throws(() => createSweep(rossler, defaultParams('rossler'), { key: 'rho' }));
  assert.deepEqual(maximaRange([{ maxima: [2, 5] }, { maxima: [] }, { maxima: [-1] }]), { lo: -1, hi: 5 });
  assert.equal(maximaRange([{ maxima: [] }]), null);
});
