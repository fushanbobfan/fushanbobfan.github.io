import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, stepSim, radius, centre, heard, STEP, historySpan } from '../src/sim.js';
import { WORLD, SOUND_SPEED } from '../src/path.js';

const run = (sim, seconds) => {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) stepSim(sim);
};

test('crests leave at the tone rate and grow at the speed of sound', () => {
  const sim = createSim({ path: 'still', rate: 2 });
  run(sim, 2);
  // t = 0, 0.5, 1, 1.5, 2
  assert.equal(sim.fronts.length, 5);
  const oldest = sim.fronts[0];
  assert.ok(Math.abs(radius(sim, oldest) - 2 * SOUND_SPEED) < 1e-6);
});

test('crests are dropped once they have left the world', () => {
  const sim = createSim({ path: 'still', rate: 2 });
  run(sim, 10);
  // Crossing the world from the middle takes under 4 s at this speed.
  assert.ok(sim.fronts.length <= 8);
  for (const f of sim.fronts) assert.ok(radius(sim, f) < Math.hypot(WORLD.width, WORLD.height));
});

test('each crest starts where the source was when it left', () => {
  const sim = createSim({ path: 'line', mach: 0.4, rate: 3 });
  run(sim, 4);
  const v = 0.4 * SOUND_SPEED;
  const first = sim.fronts.find((f) => Math.abs(f.t0 - 1) < 1e-9);
  const later = sim.fronts.find((f) => Math.abs(f.t0 - 2) < 1e-9);
  assert.ok(Math.abs(later.x - first.x - v) < 1e-6);
});

test('a still source sounds at its own pitch', () => {
  const sim = createSim({ path: 'still' });
  run(sim, 6);
  sim.listener = { x: 20, y: 20, dir: 1 };
  const im = heard(sim);
  assert.equal(im.length, 1);
  assert.ok(Math.abs(im[0].ratio - 1) < 1e-9);
});

test('a circling source never sounds lower than 1/(1+M) or higher than 1/(1-M)', () => {
  const sim = createSim({ path: 'circle', mach: 0.5 });
  sim.listener = { x: WORLD.width / 2, y: 5, dir: 1 };
  let lo = Infinity;
  let hi = 0;
  run(sim, historySpan());
  for (let i = 0; i < 1200; i++) {
    stepSim(sim);
    for (const im of heard(sim)) {
      lo = Math.min(lo, im.ratio);
      hi = Math.max(hi, im.ratio);
    }
  }
  assert.ok(lo >= 1 / 1.5 - 1e-6 && hi <= 2 + 1e-6, `${lo} ${hi}`);
  assert.ok(hi > 1.5 && lo < 0.75);
});

test('the steered source caps its speed at the Mach setting', () => {
  const sim = createSim({ path: 'drag', mach: 0.8 });
  sim.target = { x: 0, y: 0 };
  stepSim(sim);
  assert.ok(Math.abs(Math.hypot(sim.src.vx, sim.src.vy) - 0.8 * SOUND_SPEED) < 1e-9);
});

test('the wrap of the straight line is stored as a break', () => {
  const sim = createSim({ path: 'line', mach: 2 });
  run(sim, 10);
  const h = sim.history;
  let breaks = 0;
  for (let i = 1; i < h.length; i++) if (h.at(i).brk) breaks++;
  assert.ok(breaks >= 1);
  for (let i = 1; i < h.length; i++) {
    if (h.at(i).brk) continue;
    assert.ok(Math.abs(h.at(i).x - h.at(i - 1).x) < 2 * SOUND_SPEED * STEP + 1e-9);
  }
});

test('changing the Mach number mid-run does not move the source', () => {
  const sim = createSim({ path: 'line', mach: 0.4 });
  run(sim, 3);
  const x = sim.src.x;
  sim.mach = 1.6;
  stepSim(sim);
  assert.ok(Math.abs(sim.src.x - x - 1.6 * SOUND_SPEED * STEP) < 1e-9);
});

test('crests drift with the wind and keep the air shift they left with', () => {
  const sim = createSim({ path: 'still', wind: 0.4, rate: 1 });
  run(sim, 2);
  const f = sim.fronts.find((g) => Math.abs(g.t0 - 1) < 1e-9);
  const p = centre(sim, f);
  assert.ok(Math.abs(p.x - (WORLD.width / 2 + 0.4 * SOUND_SPEED * 1)) < 1e-6);
  assert.ok(Math.abs(p.y - WORLD.height / 2) < 1e-9);
});

test('a still source in a wind is heard at its own pitch, later downwind than upwind', () => {
  const up = createSim({ path: 'still', wind: 0.5, listener: { x: 20, y: 50 } });
  const down = createSim({ path: 'still', wind: 0.5, listener: { x: 140, y: 50 } });
  run(up, 12);
  run(down, 12);
  const [a] = heard(up);
  const [b] = heard(down);
  assert.ok(Math.abs(a.ratio - 1) < 1e-9 && Math.abs(b.ratio - 1) < 1e-9);
  // 60 units against a wind of 12.5 takes 60 / 12.5 s; with it, 60 / 37.5 s.
  assert.ok(Math.abs(up.t - a.tau - 60 / 12.5) < 0.02);
  assert.ok(Math.abs(down.t - b.tau - 60 / 37.5) < 0.02);
});

test('the walking listener paces its row and turns at the edges', () => {
  const sim = createSim({ path: 'still', walk: 0.8, listener: { x: WORLD.width - 1, y: 30 } });
  stepSim(sim);
  run(sim, 1);
  assert.equal(sim.listener.dir, -1);
  assert.ok(sim.listener.x <= WORLD.width && sim.listener.x > 0);
  assert.equal(sim.listener.y, 30);
});

test('walking towards a still source raises the pitch by (c + v_o) / c', () => {
  const sim = createSim({ path: 'still', walk: 0.2, listener: { x: 10, y: 50, dir: 1 } });
  run(sim, 4);
  const [im] = heard(sim);
  assert.ok(Math.abs(im.ratio - 1.2) < 1e-9, String(im.ratio));
});
