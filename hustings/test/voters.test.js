import test from 'node:test';
import assert from 'node:assert/strict';
import { voterCloud, castBallots, ballotsFromRankings, electorateAt } from '../src/voters.js';

test('the voter cloud is centred, has unit spread and replays for a seed', () => {
  const cloud = voterCloud(2000, 3);
  let sx = 0, sy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < cloud.n; i++) {
    sx += cloud.dx[i]; sy += cloud.dy[i];
    sxx += cloud.dx[i] ** 2; syy += cloud.dy[i] ** 2;
  }
  // Mirrored pairs make the mean exactly zero.
  assert.ok(Math.abs(sx / cloud.n) < 1e-12);
  assert.ok(Math.abs(sy / cloud.n) < 1e-12);
  assert.ok(Math.abs(Math.sqrt(sxx / cloud.n) - 1) < 0.06);
  assert.ok(Math.abs(Math.sqrt(syy / cloud.n) - 1) < 0.06);
  assert.deepEqual(voterCloud(2000, 3).dx, cloud.dx);
  assert.notDeepEqual(voterCloud(2000, 4).dx, cloud.dx);
});

test('an odd number of voters still fills every slot', () => {
  const cloud = voterCloud(7, 1);
  assert.equal(cloud.dx.length, 7);
  assert.ok(Number.isFinite(cloud.dx[6]));
});

test('each voter ranks candidates from nearest to farthest', () => {
  const cloud = { n: 1, dx: new Float64Array([0]), dy: new Float64Array([0]) };
  const cands = [{ x: 0.9, y: 0.5 }, { x: 0.1, y: 0.5 }, { x: 0.45, y: 0.5 }];
  const b = castBallots(cloud, 0.3, 0.5, 0.1, cands);
  assert.deepEqual([...b.order], [2, 1, 0]);
  assert.ok(Math.abs(b.dist[0] - 0.6) < 1e-12);
});

test('equal distances keep the lower-numbered candidate first', () => {
  const cloud = { n: 1, dx: new Float64Array([0]), dy: new Float64Array([0]) };
  const cands = [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.5, y: 0.9 }];
  const b = castBallots(cloud, 0.5, 0.5, 0.1, cands);
  assert.deepEqual([...b.order], [0, 1, 2]);
});

test('ballots written by hand expand their counts', () => {
  const b = ballotsFromRankings([[2, [1, 0, 2]], [1, [2, 1, 0]]]);
  assert.equal(b.n, 3);
  assert.equal(b.k, 3);
  assert.deepEqual([...b.order], [1, 0, 2, 1, 0, 2, 2, 1, 0]);
});

test('the electorate drawn on the map is the one that votes there', () => {
  const cloud = voterCloud(50, 2);
  const cands = [{ x: 0.2, y: 0.4 }, { x: 0.7, y: 0.6 }];
  const { xs, ys } = electorateAt(cloud, 0.45, 0.5, 0.1);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(Math.abs(mean(xs) - 0.45) < 1e-12);
  assert.ok(Math.abs(mean(ys) - 0.5) < 1e-12);
  const b = castBallots(cloud, 0.45, 0.5, 0.1, cands);
  for (let v = 0; v < cloud.n; v++) {
    const nearest = Math.hypot(xs[v] - 0.2, ys[v] - 0.4) <= Math.hypot(xs[v] - 0.7, ys[v] - 0.6) ? 0 : 1;
    assert.equal(b.order[v * 2], nearest);
  }
});
