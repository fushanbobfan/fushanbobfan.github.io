import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid } from '../src/hexgrid.js';
import { createModel, step } from '../src/reiter.js';
import { createSchedule, switchRadius, advance } from '../src/schedule.js';

const PLATE = { beta: 0.4, gamma: 0.3 };
const FERN = { beta: 0.4, gamma: 0.0001 };

test('a single-stage schedule steps exactly like the plain model', () => {
  const g = makeGrid(30);
  const a = createModel(g, FERN);
  const b = createModel(g, FERN);
  const sched = createSchedule(null);
  for (let k = 0; k < 20; k++) {
    step(a, 37);
    advance(b, sched, 37);
  }
  assert.equal(a.step, b.step);
  assert.deepEqual(a.s, b.s);
  assert.equal(sched.switchedAt, -1);
});

test('the switch happens once, as the ice first reaches the switch radius', () => {
  const g = makeGrid(40);
  const m = createModel(g, PLATE);
  const sched = createSchedule(FERN, 0.3);
  const r = switchRadius(sched, g);
  assert.equal(r, Math.round(0.3 * 38));
  let switches = 0;
  let extentBefore = 0;
  while (sched.switchedAt < 0 && !m.done) {
    extentBefore = m.extent;
    if (advance(m, sched, 7)) switches++;
  }
  assert.equal(switches, 1);
  assert.ok(extentBefore <= r);
  assert.equal(m.params.gamma, FERN.gamma);
  assert.equal(m.params.beta, FERN.beta);
  while (!m.done) assert.equal(advance(m, sched, 50), false);
});

test('steps taken per call are the same whether or not the switch falls inside the call', () => {
  const g = makeGrid(30);
  const a = createModel(g, PLATE);
  const b = createModel(g, PLATE);
  const sa = createSchedule(FERN, 0.4);
  const sb = createSchedule(FERN, 0.4);
  while (!a.done) advance(a, sa, 1);
  while (!b.done) advance(b, sb, 64);
  assert.equal(sa.switchedAt, sb.switchedAt);
  assert.equal(a.step, b.step);
  assert.deepEqual(a.s, b.s);
});

test('a plate that switches to fern conditions grows arms beyond a solid core', () => {
  const g = makeGrid(50);
  const m = createModel(g, PLATE);
  const sched = createSchedule(FERN, 0.35);
  while (!m.done) advance(m, sched, 25);
  const core = switchRadius(sched, g);
  let coreIce = 0;
  let coreCells = 0;
  let outerIce = 0;
  let outerCells = 0;
  for (let c = 0; c < g.count; c++) {
    if (g.dist[c] < core) {
      coreCells++;
      coreIce += m.ice[c];
    } else if (g.dist[c] <= m.extent) {
      outerCells++;
      outerIce += m.ice[c];
    }
  }
  assert.ok(coreIce / coreCells > 0.95, `core ${coreIce / coreCells}`);
  assert.ok(outerIce / outerCells < 0.5, `outer ${outerIce / outerCells}`);
});
