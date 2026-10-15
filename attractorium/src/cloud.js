// A cloud of orbits released from a tiny ball around one point. Each orbit
// keeps a short tail for drawing, and the cloud's spread (root-mean-square
// distance from its centroid) is logged so its exponential growth can be
// compared with the largest Lyapunov exponent.

import { createStepper, isFiniteState } from './integrate.js';
import { createRng } from './rng.js';

export function createCloud(system, params, { center, count = 200, radius = 1e-4, tail = 60, seed = 1, dt = system.dt } = {}) {
  const rng = createRng(seed);
  const step = createStepper(system.field, params);
  const pos = new Float64Array(count * 3);
  const alive = new Uint8Array(count).fill(1);
  for (let i = 0; i < count; i++) {
    // Uniform in a ball: a direction from three normals, a radius from the cube root.
    let gx;
    let gy;
    let gz;
    let n;
    do {
      gx = rng.range(-1, 1);
      gy = rng.range(-1, 1);
      gz = rng.range(-1, 1);
      n = gx * gx + gy * gy + gz * gz;
    } while (n > 1 || n === 0);
    const r = i === 0 ? 0 : radius * Math.cbrt(rng.next()) / Math.sqrt(n);
    pos[3 * i] = center[0] + gx * r;
    pos[3 * i + 1] = center[1] + gy * r;
    pos[3 * i + 2] = center[2] + gz * r;
  }
  const tails = new Float32Array(count * tail * 3);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < tail; k++) tails.set(pos.subarray(3 * i, 3 * i + 3), (i * tail + k) * 3);
  }
  const cloud = {
    count,
    tail,
    pos,
    alive,
    tails,
    head: 0,
    time: 0,
    dt,
    radius,
    history: [{ t: 0, spread: spreadOf(pos, alive) }],
    // Advances every orbit by `steps` steps, then records one tail point and
    // one spread sample.
    advance(steps) {
      const s = new Float64Array(3);
      for (let i = 0; i < count; i++) {
        if (!alive[i]) continue;
        s[0] = pos[3 * i];
        s[1] = pos[3 * i + 1];
        s[2] = pos[3 * i + 2];
        for (let k = 0; k < steps; k++) step(s, dt);
        if (!isFiniteState(s)) {
          alive[i] = 0;
          continue;
        }
        pos[3 * i] = s[0];
        pos[3 * i + 1] = s[1];
        pos[3 * i + 2] = s[2];
      }
      cloud.time += steps * dt;
      cloud.head = (cloud.head + 1) % tail;
      for (let i = 0; i < count; i++) {
        const o = (i * tail + cloud.head) * 3;
        tails[o] = pos[3 * i];
        tails[o + 1] = pos[3 * i + 1];
        tails[o + 2] = pos[3 * i + 2];
      }
      cloud.history.push({ t: cloud.time, spread: spreadOf(pos, alive) });
      return cloud;
    },
    // Tail point `age` steps back (0 is the newest) of orbit i, written to out.
    tailPoint(i, age, out) {
      const k = (cloud.head - age + tail * 2) % tail;
      const o = (i * tail + k) * 3;
      out[0] = tails[o];
      out[1] = tails[o + 1];
      out[2] = tails[o + 2];
      return out;
    },
    aliveCount() {
      let n = 0;
      for (let i = 0; i < count; i++) n += alive[i];
      return n;
    },
  };
  return cloud;
}

export function spreadOf(pos, alive) {
  let n = 0;
  const m = [0, 0, 0];
  for (let i = 0; i < alive.length; i++) {
    if (!alive[i]) continue;
    n++;
    for (let a = 0; a < 3; a++) m[a] += pos[3 * i + a];
  }
  if (n < 2) return 0;
  for (let a = 0; a < 3; a++) m[a] /= n;
  let sum = 0;
  for (let i = 0; i < alive.length; i++) {
    if (!alive[i]) continue;
    for (let a = 0; a < 3; a++) {
      const d = pos[3 * i + a] - m[a];
      sum += d * d;
    }
  }
  return Math.sqrt(sum / n);
}

// Least-squares slope of ln(spread) against time over samples whose spread
// lies between `lo` and `hi`: the stretch where growth is exponential, after
// the cloud has lined up with the unstable direction and before it has
// saturated at the size of the attractor.
export function growthRate(history, lo, hi) {
  let n = 0;
  let st = 0;
  let sy = 0;
  let stt = 0;
  let sty = 0;
  for (const { t, spread } of history) {
    if (!(spread > lo && spread < hi)) continue;
    const y = Math.log(spread);
    n++;
    st += t;
    sy += y;
    stt += t * t;
    sty += t * y;
  }
  if (n < 3) return { rate: NaN, samples: n };
  const den = n * stt - st * st;
  if (den === 0) return { rate: NaN, samples: n };
  return { rate: (n * sty - st * sy) / den, samples: n };
}
