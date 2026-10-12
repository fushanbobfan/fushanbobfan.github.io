import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, LAYOUTS } from '../src/spawn.js';
import { createAgents } from '../src/agents.js';
import { createRng } from '../src/rng.js';
import { createTrail, setWall, isWall } from '../src/trail.js';

const W = 200;
const H = 120;

for (const layout of Object.keys(LAYOUTS)) {
  test(`${layout}: every particle starts inside the world with a valid heading`, () => {
    const a = createAgents(3000);
    spawn(a, layout, 3000, W, H, createRng(5));
    assert.equal(a.count, 3000);
    for (let i = 0; i < a.count; i++) {
      assert.ok(a.x[i] >= 0 && a.x[i] < W);
      assert.ok(a.y[i] >= 0 && a.y[i] < H);
      assert.ok(a.heading[i] >= 0 && a.heading[i] < 2 * Math.PI);
    }
  });
}

test('spawning again replaces the previous particles', () => {
  const a = createAgents(100);
  spawn(a, 'scatter', 100, W, H, createRng(1));
  spawn(a, 'disc', 40, W, H, createRng(1));
  assert.equal(a.count, 40);
});

test('a ring faces the centre', () => {
  const a = createAgents(500);
  spawn(a, 'ring', 500, W, H, createRng(2));
  for (let i = 0; i < a.count; i++) {
    const toCentre = Math.atan2(H / 2 - a.y[i], W / 2 - a.x[i]);
    const diff = Math.abs(Math.atan2(Math.sin(a.heading[i] - toCentre), Math.cos(a.heading[i] - toCentre)));
    assert.ok(diff < 1e-3);
  }
});

test('a burst faces away from the centre', () => {
  const a = createAgents(500);
  spawn(a, 'burst', 500, W, H, createRng(3));
  for (let i = 0; i < a.count; i++) {
    const dx = a.x[i] - W / 2;
    const dy = a.y[i] - H / 2;
    const dot = dx * Math.cos(a.heading[i]) + dy * Math.sin(a.heading[i]);
    assert.ok(dot >= -1e-3);
  }
});

test('the same seed reproduces the same layout', () => {
  const a = createAgents(50);
  const b = createAgents(50);
  spawn(a, 'scatter', 50, W, H, createRng(11));
  spawn(b, 'scatter', 50, W, H, createRng(11));
  assert.deepEqual(a.x, b.x);
  assert.deepEqual(a.heading, b.heading);
});

test('no particle starts inside a wall', () => {
  const trail = createTrail(W, H);
  for (let y = 0; y < H; y++) for (let x = 60; x < 140; x++) setWall(trail, y * W + x, true);
  for (const layout of Object.keys(LAYOUTS)) {
    const a = createAgents(2000);
    spawn(a, layout, 2000, W, H, createRng(8), trail);
    assert.equal(a.count, 2000);
    for (let i = 0; i < a.count; i++) assert.ok(!isWall(trail, a.x[i], a.y[i], false), layout);
  }
});
