import { seededRandom } from './rng.js';

// Offsets of a round normal cloud of voters with standard deviation 1.
// The same cloud is shifted to every point of the map, so neighbouring
// cells differ only because the centre moved, never because of fresh noise.
export function voterCloud(n, seed = 1) {
  const rng = seededRandom(seed);
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  for (let i = 0; i < n; i += 2) {
    // Box-Muller gives two independent normals per pair of uniforms.
    const u = 1 - rng();
    const v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    dx[i] = r * Math.cos(2 * Math.PI * v);
    dy[i] = r * Math.sin(2 * Math.PI * v);
    if (i + 1 < n) {
      dx[i + 1] = -dx[i];
      dy[i + 1] = -dy[i];
    }
  }
  return { n, dx, dy };
}

// Each voter ranks the candidates from nearest to farthest.
// order[v*k + r] is voter v's r-th choice; dist[v*k + c] is the distance to candidate c.
export function castBallots(cloud, cx, cy, spread, candidates, out) {
  const { n, dx, dy } = cloud;
  const k = candidates.length;
  const ballots = out && out.n === n && out.k === k ? out : {
    n, k, order: new Uint8Array(n * k), dist: new Float64Array(n * k),
  };
  const { order, dist } = ballots;
  for (let v = 0; v < n; v++) {
    const x = cx + spread * dx[v];
    const y = cy + spread * dy[v];
    const base = v * k;
    for (let c = 0; c < k; c++) {
      const ex = x - candidates[c].x;
      const ey = y - candidates[c].y;
      dist[base + c] = Math.sqrt(ex * ex + ey * ey);
      // Insertion sort: k is at most six, and ties keep the lower index first.
      let r = c;
      while (r > 0 && dist[base + order[base + r - 1]] > dist[base + c]) {
        order[base + r] = order[base + r - 1];
        r--;
      }
      order[base + r] = c;
    }
  }
  return ballots;
}

// Ballots written out by hand, for worked examples: [[count, [ranking...]], ...].
// Distances follow the ranking, so approval treats the top half as approved.
export function ballotsFromRankings(groups) {
  const k = groups[0][1].length;
  const n = groups.reduce((s, [count]) => s + count, 0);
  const order = new Uint8Array(n * k);
  const dist = new Float64Array(n * k);
  let v = 0;
  for (const [count, ranking] of groups) {
    for (let i = 0; i < count; i++, v++) {
      ranking.forEach((c, r) => {
        order[v * k + r] = c;
        dist[v * k + c] = r;
      });
    }
  }
  return { n, k, order, dist };
}

// Where each voter of the cloud stands when it is centred on (cx, cy).
export function electorateAt(cloud, cx, cy, spread) {
  const xs = new Float64Array(cloud.n);
  const ys = new Float64Array(cloud.n);
  for (let v = 0; v < cloud.n; v++) {
    xs[v] = cx + spread * cloud.dx[v];
    ys[v] = cy + spread * cloud.dy[v];
  }
  return { xs, ys };
}
