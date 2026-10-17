// Brownian motion of the tracer. Its position is sampled at a fixed
// simulated-time interval, and the mean squared displacement over a lag tau
// is averaged over every starting sample in the record. In two dimensions
//   short lags: MSD = (2kT / M) tau^2   (free flight at thermal speed),
//   long lags:  MSD = 4 D tau           (a random walk),
// and the crossover sits near the time the tracer takes to forget its
// velocity.

export function createTrajectory(interval, cap = 4000) {
  return { interval, cap, next: 0, x: [], y: [] };
}

// Record the position whenever simulated time has passed the next sample.
export function recordPosition(traj, t, x, y) {
  if (t + 1e-12 < traj.next) return false;
  traj.x.push(x);
  traj.y.push(y);
  traj.next = (traj.next === 0 && traj.x.length === 1 ? t : traj.next) + traj.interval;
  if (traj.x.length > traj.cap) {
    traj.x.shift();
    traj.y.shift();
  }
  return true;
}

// Lags in samples, roughly `perDecade` per factor of ten, from 1 to maxLag.
export function logLags(maxLag, perDecade = 8) {
  const lags = [];
  let last = 0;
  for (let k = 0; ; k++) {
    const lag = Math.round(10 ** (k / perDecade));
    if (lag > maxLag) break;
    if (lag > last) {
      lags.push(lag);
      last = lag;
    }
  }
  return lags;
}

export function meanSquaredDisplacement(traj, lags) {
  const n = traj.x.length;
  const out = [];
  for (const lag of lags) {
    if (lag >= n) break;
    let sum = 0;
    for (let i = 0; i + lag < n; i++) {
      const dx = traj.x[i + lag] - traj.x[i];
      const dy = traj.y[i + lag] - traj.y[i];
      sum += dx * dx + dy * dy;
    }
    out.push({ tau: lag * traj.interval, msd: sum / (n - lag) });
  }
  return out;
}

// Longest lag worth plotting: a third of the record for averaging, and no
// more than `maxTime`, after which the walls start to hold the tracer in.
export function usefulLag(traj, maxTime = 300) {
  return Math.min(Math.floor(traj.x.length / 3), Math.floor(maxTime / traj.interval));
}

export function ballisticMsd(tau, kT, mass) {
  return ((2 * kT) / mass) * tau * tau;
}

// Least-squares line MSD = 4 D tau + b through the points with tau >= tauMin.
export function fitDiffusion(points, tauMin = 0) {
  const use = points.filter((p) => p.tau >= tauMin);
  if (use.length < 2) return null;
  let st = 0;
  let sm = 0;
  let stt = 0;
  let stm = 0;
  for (const { tau, msd } of use) {
    st += tau;
    sm += msd;
    stt += tau * tau;
    stm += tau * msd;
  }
  const k = use.length;
  const den = k * stt - st * st;
  if (den === 0) return null;
  const slope = (k * stm - st * sm) / den;
  return { D: slope / 4, b: (sm - slope * st) / k, points: k };
}

// Where to start the diffusive fit: the first lag at which the measured MSD
// has fallen below 30% of the ballistic value, i.e. well past the velocity
// memory. Returns Infinity if the run is still ballistic.
export function diffusiveOnset(points, kT, mass, ratio = 0.3) {
  for (const p of points) {
    if (p.msd < ratio * ballisticMsd(p.tau, kT, mass)) return p.tau;
  }
  return Infinity;
}
