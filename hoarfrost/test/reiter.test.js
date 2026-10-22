import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, rotate, reflect } from '../src/hexgrid.js';
import {
  createModel, step, setParams, totalWater, EDGE_MARGIN,
} from '../src/reiter.js';

test('the model starts as one ice cell in background vapour', () => {
  const g = makeGrid(10);
  const m = createModel(g, { beta: 0.4 });
  assert.equal(m.iceCount, 1);
  assert.equal(m.ice[g.center], 1);
  assert.equal(m.frozenAt[g.center], 0);
  assert.equal(m.receptive.reduce((a, b) => a + b, 0), 7);
  assert.equal(m.s[g.index(3, 2)], 0.4);
});

test('uniform vapour with no seed is left exactly as it is', () => {
  const g = makeGrid(12);
  const m = createModel(g, { beta: 0.55, gamma: 0.01 }, { seed: false });
  step(m, 50);
  for (let c = 0; c < g.count; c++) assert.equal(m.s[c], 0.55);
  assert.equal(m.iceCount, 0);
});

test('with no vapour added, diffusion only moves water around inside the patch', () => {
  // Take the boundary out of play by keeping the growth small and starting
  // from a sharp spike away from the edge.
  const g = makeGrid(30);
  const m = createModel(g, { alpha: 1.2, beta: 0, gamma: 0 }, { seed: false });
  m.s[g.index(2, -1)] = 0.9;
  const before = totalWater(m);
  step(m, 20);
  assert.ok(Math.abs(totalWater(m) - before) < 1e-12);
  assert.ok(m.s[g.index(2, -1)] < 0.9);
  assert.ok(m.s[g.index(4, -1)] > 0);
});

test('ice never melts and each cell records the step it froze', () => {
  const g = makeGrid(30);
  const m = createModel(g, { beta: 0.4, gamma: 0.001 });
  let prev = m.ice.slice();
  for (let k = 0; k < 40; k++) {
    step(m, 10);
    for (let c = 0; c < g.count; c++) {
      if (prev[c]) assert.equal(m.ice[c], 1);
      if (m.ice[c]) {
        assert.ok(m.frozenAt[c] >= 0 && m.frozenAt[c] <= m.step);
        assert.ok(m.s[c] >= 1);
      } else {
        assert.equal(m.frozenAt[c], -1);
      }
    }
    prev = m.ice.slice();
  }
  assert.ok(m.iceCount > 1);
});

test('receptive cells are exactly the ice and its neighbours', () => {
  const g = makeGrid(25);
  const m = step(createModel(g, { beta: 0.5, gamma: 0.002 }), 200);
  for (let c = 0; c < g.count; c++) {
    const touches = [...g.neighbors.subarray(c * 6, c * 6 + 6)].some((n) => n >= 0 && m.ice[n]);
    assert.equal(m.receptive[c], m.ice[c] || touches ? 1 : 0);
  }
});

test('the crystal keeps the twelvefold symmetry of the hexagonal lattice', () => {
  const g = makeGrid(40);
  const m = step(createModel(g, { beta: 0.35, gamma: 0.001 }), 1500);
  assert.ok(m.iceCount > 30, `${m.iceCount} ice cells`);
  for (let c = 0; c < g.count; c++) {
    const images = [rotate(g.q[c], g.r[c]), reflect(g.q[c], g.r[c])];
    for (const [q, r] of images) {
      const d = g.index(q, r);
      assert.ok(Math.abs(m.s[c] - m.s[d]) < 1e-9, `cell ${g.q[c]},${g.r[c]}`);
      if (Math.abs(m.s[c] - 1) > 1e-9) assert.equal(m.ice[c], m.ice[d]);
    }
  }
});

test('growth stops once ice comes within the margin of the outer ring', () => {
  const g = makeGrid(14);
  const m = createModel(g, { beta: 0.9, gamma: 0.01 });
  step(m, 100000);
  assert.equal(m.done, true);
  assert.equal(m.extent, g.radius - EDGE_MARGIN);
  const at = m.step;
  step(m, 10);
  assert.equal(m.step, at);
});

test('denser background vapour grows a fuller crystal', () => {
  const g = makeGrid(40);
  const fill = (beta) => {
    const m = createModel(g, { beta, gamma: 0.0001 });
    while (!m.done && m.step < 60000) step(m, 100);
    assert.equal(m.done, true, `beta ${beta} did not reach the edge`);
    return m.iceCount;
  };
  const sparse = fill(0.35);
  const dense = fill(0.9);
  assert.ok(dense > 1.5 * sparse, `${sparse} vs ${dense}`);
});

test('new parameters take effect from the next step and the ring follows the new beta', () => {
  const g = makeGrid(20);
  const a = step(createModel(g, { beta: 0.4, gamma: 0.001 }), 30);
  const b = step(createModel(g, { beta: 0.4, gamma: 0.001 }), 30);
  setParams(b, { beta: 0.6 });
  assert.equal(b.params.gamma, 0.001);
  step(a, 1);
  step(b, 1);
  const ring = g.index(g.radius, 0);
  assert.equal(a.s[ring], 0.4);
  assert.equal(b.s[ring], 0.6);
  let same = true;
  for (let c = 0; c < g.count; c++) if (!g.boundary[c] && a.s[c] !== b.s[c]) same = false;
  assert.ok(same, 'interior should only feel the change one step later');
  step(a, 1);
  step(b, 1);
  assert.ok(b.s[g.index(g.radius - 1, 0)] > a.s[g.index(g.radius - 1, 0)]);
});
