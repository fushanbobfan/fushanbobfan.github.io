// Measures systems without a browser: largest Lyapunov exponent, extent and
// the number of distinct maxima (1, 2, 4 ... for periodic orbits).
// Usage: node scripts/probe.js [--system lorenz] [--set rho=99.65] [--time 400]

import { SYSTEMS, SYSTEM_KEYS, defaultParams } from '../src/systems.js';
import { sampleOrbit, bounds, largestLyapunov, successiveMaxima, distinctLevels } from '../src/integrate.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const keys = opt('system') ? [opt('system')] : SYSTEM_KEYS;
const time = Number(opt('time', 400));
const overrides = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set') {
    const [k, v] = args[i + 1].split('=');
    overrides[k] = Number(v);
  }
}

for (const key of keys) {
  const s = SYSTEMS[key];
  if (!s) {
    console.error(`unknown system ${key}; choose from ${SYSTEM_KEYS.join(', ')}`);
    process.exit(1);
  }
  const p = { ...defaultParams(key), ...overrides };
  for (const k of Object.keys(overrides)) if (!(k in defaultParams(key))) delete p[k];
  const o = sampleOrbit(s, p, { transient: Math.round(300 / s.dt), count: Math.round(200 / s.dt) });
  if (o.escaped) {
    console.log(`${s.name.padEnd(10)} escapes to infinity`);
    continue;
  }
  const b = bounds(o.points, o.length);
  const axis = s.mapAxis ?? s.up;
  const levels = distinctLevels(successiveMaxima(o.points, o.length, axis), 1e-3).length;
  const lambda = largestLyapunov(s, p, { time });
  const range = b.min.map((m, a) => `${m.toFixed(1)}..${b.max[a].toFixed(1)}`).join(' ');
  const params = Object.entries(p).map(([k, v]) => `${k}=${+v.toFixed(6)}`).join(' ');
  console.log(`${s.name.padEnd(10)} λ=${lambda.toFixed(3).padStart(7)}  maxima levels=${String(levels).padStart(4)}  ${range}  [${params}]`);
}
