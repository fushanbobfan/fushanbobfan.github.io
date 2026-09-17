import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hueFromHeading, hueFromSpeed, boidColour, drawFrame, COLOUR_MODES } from '../src/render.js';
import { Simulation } from '../src/simulation.js';

test('hueFromHeading wraps negative and large angles into [0, 360)', () => {
  assert.equal(hueFromHeading(0), 0);
  assert.equal(hueFromHeading(Math.PI), 180);
  assert.equal(hueFromHeading(-Math.PI / 2), 270);
  assert.ok(Math.abs(hueFromHeading(3 * Math.PI) - 180) < 1e-9);
});

test('hueFromSpeed runs from cool to hot and clamps', () => {
  assert.equal(hueFromSpeed(0), 220);
  assert.equal(hueFromSpeed(1), 0);
  assert.equal(hueFromSpeed(-1), 220);
  assert.equal(hueFromSpeed(5), 0);
});

test('boidColour returns an hsl string for the dynamic modes and a flat colour otherwise', () => {
  const b = { x: 0, y: 0, vel: { x: 3, y: 0 } };
  assert.match(boidColour(b, 'heading', 3), /^hsl\(0 /);
  assert.match(boidColour(b, 'speed', 3), /^hsl\(0 /);
  assert.equal(boidColour(b, 'plain', 3), '#d9e3ff');
  assert.equal(COLOUR_MODES.length, 3);
});

// A minimal stand-in for CanvasRenderingContext2D that just records calls.
function fakeContext() {
  const calls = [];
  const record = (name) => (...args) => { calls.push([name, ...args]); };
  const ctx = {};
  for (const m of ['save', 'restore', 'translate', 'rotate', 'beginPath', 'moveTo', 'lineTo',
    'closePath', 'fill', 'fillRect', 'arc', 'stroke', 'setLineDash']) ctx[m] = record(m);
  ctx.calls = calls;
  return ctx;
}

test('drawFrame clears the canvas and draws one shape per boid', () => {
  const sim = new Simulation({ width: 200, height: 100, count: 7, seed: 3 });
  const ctx = fakeContext();
  drawFrame(ctx, sim, { trails: false });
  const clears = ctx.calls.filter(([m]) => m === 'fillRect');
  assert.deepEqual(clears, [['fillRect', 0, 0, 200, 100]]);
  assert.equal(ctx.calls.filter(([m]) => m === 'closePath').length, 7);
});

test('drawFrame draws the threat marker only when a threat is set', () => {
  const sim = new Simulation({ width: 200, height: 100, count: 1, seed: 3 });
  const ctx = fakeContext();
  drawFrame(ctx, sim);
  assert.equal(ctx.calls.filter(([m]) => m === 'arc').length, 0);
  sim.setThreat({ x: 10, y: 10 });
  drawFrame(ctx, sim);
  assert.equal(ctx.calls.filter(([m]) => m === 'arc').length, 2);
});
