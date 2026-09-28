// Reiter's local cellular model of snow crystal growth (C. A. Reiter, Chaos,
// Solitons & Fractals 23, 2005).
//
// Every cell holds an amount of water s. A cell with s >= 1 is ice. A cell is
// receptive if it is ice or touches ice. Each step:
//   1. receptive cells keep their water and gain gamma from the air;
//   2. the water in all other cells diffuses: u <- u + (alpha / 2)(mean - u),
//      where mean is the average over the six neighbours and receptive
//      neighbours count as holding nothing;
//   3. the two parts are added back together.
// Cells on the outer ring stay at the background level beta, standing in for
// the vapour far from the crystal. The crystal starts as one ice cell.

export const DEFAULT_PARAMS = { alpha: 1, beta: 0.4, gamma: 0.001 };

// Growth stops when ice gets this close to the outer ring.
export const EDGE_MARGIN = 2;

export function createModel(grid, params = {}, { seed = true } = {}) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const s = new Float64Array(grid.count).fill(p.beta);
  const model = {
    grid,
    params: p,
    s,
    u: new Float64Array(grid.count),
    next: new Float64Array(grid.count),
    ice: new Uint8Array(grid.count),
    receptive: new Uint8Array(grid.count),
    frozenAt: new Int32Array(grid.count).fill(-1),
    step: 0,
    iceCount: 0,
    extent: 0,
    done: false,
  };
  if (seed) s[grid.center] = 1;
  refresh(model);
  return model;
}

// Mark ice and receptive cells and record when each cell froze.
function refresh(model) {
  const { grid, s, ice, receptive, frozenAt } = model;
  const { count, neighbors, dist } = grid;
  let iceCount = 0;
  let extent = model.extent;
  for (let c = 0; c < count; c++) {
    if (s[c] >= 1) {
      if (!ice[c]) {
        ice[c] = 1;
        frozenAt[c] = model.step;
        if (dist[c] > extent) extent = dist[c];
      }
      iceCount++;
    }
  }
  for (let c = 0; c < count; c++) {
    let r = ice[c];
    if (!r) {
      for (let k = 0; k < 6; k++) {
        const n = neighbors[c * 6 + k];
        if (n >= 0 && ice[n]) {
          r = 1;
          break;
        }
      }
    }
    receptive[c] = r;
  }
  model.iceCount = iceCount;
  model.extent = extent;
  model.done = extent >= grid.radius - EDGE_MARGIN;
}

export function step(model, times = 1) {
  const { grid, params, s, u, next, receptive } = model;
  const { count, neighbors, boundary } = grid;
  const half = params.alpha / 2;
  for (let t = 0; t < times && !model.done; t++) {
    for (let c = 0; c < count; c++) u[c] = receptive[c] ? 0 : s[c];
    for (let c = 0; c < count; c++) {
      if (boundary[c]) {
        next[c] = params.beta;
        continue;
      }
      let sum = 0;
      for (let k = 0; k < 6; k++) sum += u[neighbors[c * 6 + k]];
      const diffused = u[c] + half * (sum / 6 - u[c]);
      next[c] = receptive[c] ? s[c] + params.gamma + diffused : diffused;
    }
    s.set(next);
    model.step++;
    refresh(model);
  }
  return model;
}

// Total water in the patch, ice included.
export function totalWater(model) {
  let sum = 0;
  for (let c = 0; c < model.grid.count; c++) sum += model.s[c];
  return sum;
}
