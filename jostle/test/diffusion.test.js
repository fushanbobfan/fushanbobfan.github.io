import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, gaussian } from '../src/rng.js';
import { createGas } from '../src/gas.js';
import { step, createGrid, safeStep } from '../src/physics.js';
import {
  createTrajectory, recordPosition, logLags, meanSquaredDisplacement,
  ballisticMsd, fitDiffusion, diffusiveOnset, usefulLag,
} from '../src/diffusion.js';

test('positions are recorded once per interval and the record is capped', () => {
  const traj = createTrajectory(1, 5);
  let kept = 0;
  for (let t = 0; t <= 10; t += 0.25) if (recordPosition(traj, t, t, 0)) kept++;
  assert.equal(kept, 11);
  assert.equal(traj.x.length, 5);
  assert.deepEqual(traj.x, [6, 7, 8, 9, 10]);
});

test('log-spaced lags are increasing integers within range', () => {
  const lags = logLags(1000, 5);
  assert.equal(lags[0], 1);
  assert.ok(lags[lags.length - 1] <= 1000);
  for (let k = 1; k < lags.length; k++) assert.ok(lags[k] > lags[k - 1]);
  assert.ok(lags.includes(10) && lags.includes(100) && lags.includes(1000));
});

test('straight-line motion gives v^2 tau^2', () => {
  const traj = createTrajectory(0.5);
  for (let k = 0; k < 50; k++) recordPosition(traj, k * 0.5, 3 * k * 0.5, 4 * k * 0.5);
  for (const p of meanSquaredDisplacement(traj, [1, 4, 10])) {
    assert.ok(Math.abs(p.msd - 25 * p.tau * p.tau) < 1e-9);
  }
});

test('a random walk with known D is recovered by the fit', () => {
  const normal = gaussian(mulberry32(17));
  const D = 0.3;
  const dt = 0.1;
  const sd = Math.sqrt(2 * D * dt);
  const traj = createTrajectory(dt, 20000);
  let x = 0;
  let y = 0;
  for (let k = 0; k < 20000; k++) {
    recordPosition(traj, k * dt, x, y);
    x += sd * normal();
    y += sd * normal();
  }
  const pts = meanSquaredDisplacement(traj, logLags(100));
  const fit = fitDiffusion(pts);
  assert.ok(Math.abs(fit.D / D - 1) < 0.1, `D = ${fit.D}`);
});

test('the onset is where MSD drops well under the ballistic line', () => {
  const pts = [
    { tau: 1, msd: 2 }, { tau: 2, msd: 7 }, { tau: 4, msd: 12 }, { tau: 8, msd: 20 },
  ];
  // Ballistic with 2kT/M = 2: 2, 8, 32, 128.
  assert.equal(diffusiveOnset(pts, 1, 1, 0.25), 8);
  assert.equal(diffusiveOnset(pts, 1, 1, 0.4), 4);
  assert.equal(diffusiveOnset(pts.slice(0, 2), 1, 1), Infinity);
});

test('a heavy tracer in the gas starts ballistic and then diffuses', () => {
  const gas = createGas({ n: 500, radius: 1.2, tracer: { radius: 5, mass: 20 }, seed: 12 });
  const grid = createGrid(gas);
  const dt = safeStep(gas, 0.25);
  const traj = createTrajectory(0.5, 5000);
  for (let s = 0; s < 12000; s++) {
    step(gas, dt, grid);
    recordPosition(traj, gas.time, gas.x[0], gas.y[0]);
  }
  const pts = meanSquaredDisplacement(traj, logLags(Math.floor(traj.x.length / 4)));
  const first = pts[0];
  const ratio = first.msd / ballisticMsd(first.tau, 1, 20);
  assert.ok(ratio > 0.6 && ratio < 1.4, `short-lag ratio ${ratio}`);
  const onset = diffusiveOnset(pts, 1, 20);
  assert.ok(Number.isFinite(onset));
  const fit = fitDiffusion(pts, onset);
  assert.ok(fit && fit.D > 0);
});

test('the useful lag is a third of the record, capped in time', () => {
  const traj = createTrajectory(0.5, 10000);
  for (let k = 0; k < 300; k++) recordPosition(traj, k * 0.5, 0, 0);
  assert.equal(usefulLag(traj), 100);
  for (let k = 300; k < 6000; k++) recordPosition(traj, k * 0.5, 0, 0);
  assert.equal(usefulLag(traj), 600);
});
