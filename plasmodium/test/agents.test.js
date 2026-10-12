import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgents, addAgent, chooseTurn, stepAgents, smell } from '../src/agents.js';
import { createTrail, deposit, totalTrail, setWall, sample } from '../src/trail.js';
import { createRng } from '../src/rng.js';

const deg = Math.PI / 180;
const params = {
  sensorAngle: 45 * deg,
  sensorDistance: 4,
  turnAngle: 45 * deg,
  stepSize: 1,
  depositAmount: 5,
};

test('turn choice follows the strongest reading', () => {
  assert.equal(chooseTurn(1, 3, 2), 0);
  assert.equal(chooseTurn(3, 2, 1), -1);
  assert.equal(chooseTurn(1, 2, 3), 1);
  assert.equal(chooseTurn(2, 1, 2), 2);
  assert.equal(chooseTurn(2, 2, 2), 0);
});

test('capacity limits how many particles can be added', () => {
  const a = createAgents(2);
  assert.ok(addAgent(a, 0, 0, 0));
  assert.ok(addAgent(a, 1, 1, 0));
  assert.equal(addAgent(a, 2, 2, 0), false);
  assert.equal(a.count, 2);
});

test('a particle on an empty trail walks straight and lays trail', () => {
  const trail = createTrail(40, 40);
  const a = createAgents(1);
  addAgent(a, 10.5, 10.5, 0);
  const rng = createRng(1);
  for (let i = 0; i < 5; i++) stepAgents(a, trail, params, rng, false);
  // Nothing to smell yet except what it just laid, which is behind it.
  assert.ok(Math.abs(a.x[0] - 15.5) < 1e-5);
  assert.ok(Math.abs(a.y[0] - 10.5) < 1e-5);
  assert.equal(totalTrail(trail), 25);
});

test('a particle turns towards trail on its right-hand sensor', () => {
  const trail = createTrail(40, 40);
  const a = createAgents(1);
  addAgent(a, 10.5, 20.5, 0);
  // Heading 0 points along +x; with y downwards the right sensor sits below.
  const sx = 11.5 + Math.cos(params.sensorAngle) * 4;
  const sy = 20.5 + Math.sin(params.sensorAngle) * 4;
  deposit(trail, sx, sy, 100, false);
  stepAgents(a, trail, params, createRng(1), false);
  assert.ok(Math.abs(a.heading[0] - params.turnAngle) < 1e-5);
});

test('a particle at the rim of a closed world stays inside', () => {
  const trail = createTrail(10, 10);
  const a = createAgents(1);
  addAgent(a, 9.5, 5, 0);
  const rng = createRng(4);
  for (let i = 0; i < 200; i++) {
    stepAgents(a, trail, params, rng, false);
    assert.ok(a.x[0] >= 0 && a.x[0] < 10 && a.y[0] >= 0 && a.y[0] < 10);
  }
});

test('a wrapping world carries a particle across the edge', () => {
  const trail = createTrail(10, 10);
  const a = createAgents(1);
  addAgent(a, 9.5, 5, 0);
  stepAgents(a, trail, params, createRng(1), true);
  assert.ok(Math.abs(a.x[0] - 0.5) < 1e-5);
});

test('headings stay in [0, 2 pi)', () => {
  const trail = createTrail(30, 30);
  const a = createAgents(200);
  const rng = createRng(9);
  for (let i = 0; i < 200; i++) addAgent(a, rng.range(0, 30), rng.range(0, 30), rng.range(0, 2 * Math.PI));
  for (let s = 0; s < 50; s++) stepAgents(a, trail, params, rng, true);
  for (let i = 0; i < a.count; i++) assert.ok(a.heading[i] >= 0 && a.heading[i] < 2 * Math.PI);
});

test('a particle never steps into a wall', () => {
  const trail = createTrail(20, 20);
  for (let y = 0; y < 20; y++) setWall(trail, y * 20 + 10, true);
  const a = createAgents(50);
  const rng = createRng(6);
  for (let i = 0; i < 50; i++) addAgent(a, rng.range(0, 10), rng.range(0, 20), rng.range(0, 2 * Math.PI));
  for (let s = 0; s < 300; s++) {
    stepAgents(a, trail, params, rng, true);
    for (let i = 0; i < a.count; i++) assert.notEqual(Math.floor(a.x[i]), 10);
  }
});

test('a colony smells its own trail minus the others, scaled by repel', () => {
  const a = createTrail(4, 4);
  const b = createTrail(4, 4);
  deposit(a, 1, 1, 3, false);
  deposit(b, 1, 1, 2, false);
  assert.equal(smell([a, b], 0, 1, 1, 0.5, false), 2);
  assert.equal(smell([a, b], 1, 1, 1, 0.5, false), 0.5);
  assert.equal(smell([a], 0, 1, 1, 0.5, false), 3);
});

test('each colony lays trail in its own layer', () => {
  const layers = [createTrail(30, 30), createTrail(30, 30)];
  const a = createAgents(2);
  addAgent(a, 5.5, 5.5, 0, 0);
  addAgent(a, 20.5, 20.5, 0, 1);
  stepAgents(a, layers, params, createRng(1), true);
  assert.equal(totalTrail(layers[0]), 5);
  assert.equal(totalTrail(layers[1]), 5);
  assert.equal(sample(layers[0], 6.5, 5.5, true), 5);
  assert.equal(sample(layers[1], 21.5, 20.5, true), 5);
});

test('a particle turns away from a rival trail on its right', () => {
  const layers = [createTrail(40, 40), createTrail(40, 40)];
  const a = createAgents(1);
  addAgent(a, 10.5, 20.5, 0, 0);
  // Rival trail ahead and to the right; nothing on the left, so turn left.
  deposit(layers[1], 11.5 + 4, 20.5, 100, false);
  deposit(layers[1], 11.5 + Math.cos(params.sensorAngle) * 4, 20.5 + Math.sin(params.sensorAngle) * 4, 100, false);
  stepAgents(a, layers, { ...params, repel: 1 }, createRng(1), false);
  assert.ok(Math.abs(a.heading[0] - (2 * Math.PI - params.turnAngle)) < 1e-5);
});
