// The gas: N hard disks in a rectangular box, stored as flat arrays.
// Units are arbitrary but consistent: lengths in box units, Boltzmann's
// constant is 1, so "kT" is an energy and in two dimensions the mean
// kinetic energy per disk equals kT.

import { mulberry32, gaussian } from './rng.js';

export function createGas({
  n = 300,
  radius = 1,
  width = 100,
  height = 100,
  kT = 1,
  mass = 1,
  seed = 1,
} = {}) {
  const rand = mulberry32(seed);
  const normal = gaussian(rand);
  const gas = {
    n,
    width,
    height,
    x: new Float64Array(n),
    y: new Float64Array(n),
    vx: new Float64Array(n),
    vy: new Float64Array(n),
    r: new Float64Array(n).fill(radius),
    m: new Float64Array(n).fill(mass),
    time: 0,
    collisions: 0,
  };
  placeWithoutOverlap(gas, rand);
  const sd = Math.sqrt(kT / mass);
  for (let i = 0; i < n; i++) {
    gas.vx[i] = sd * normal();
    gas.vy[i] = sd * normal();
  }
  removeDrift(gas);
  setTemperature(gas, kT);
  return gas;
}

// Put disks on randomly chosen cells of a grid whose spacing fits the
// largest disk, jittered inside their cell so the start is not a crystal.
export function placeWithoutOverlap(gas, rand) {
  const { n, width, height } = gas;
  let rmax = 0;
  for (let i = 0; i < n; i++) rmax = Math.max(rmax, gas.r[i]);
  const cols = Math.max(1, Math.floor(width / (2 * rmax)));
  const rows = Math.max(1, Math.floor(height / (2 * rmax)));
  if (cols * rows < n) {
    throw new RangeError(`cannot fit ${n} disks of radius ${rmax} in ${width}x${height}`);
  }
  const cw = width / cols;
  const ch = height / rows;
  const cells = Array.from({ length: cols * rows }, (_, k) => k);
  for (let k = cells.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [cells[k], cells[j]] = [cells[j], cells[k]];
  }
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    const ri = gas.r[i];
    const slackX = cw / 2 - ri;
    const slackY = ch / 2 - ri;
    gas.x[i] = ((c % cols) + 0.5) * cw + (rand() * 2 - 1) * slackX;
    gas.y[i] = (Math.floor(c / cols) + 0.5) * ch + (rand() * 2 - 1) * slackY;
  }
}

export function momentum(gas) {
  let px = 0;
  let py = 0;
  for (let i = 0; i < gas.n; i++) {
    px += gas.m[i] * gas.vx[i];
    py += gas.m[i] * gas.vy[i];
  }
  return [px, py];
}

export function removeDrift(gas) {
  const [px, py] = momentum(gas);
  let mt = 0;
  for (let i = 0; i < gas.n; i++) mt += gas.m[i];
  if (mt === 0) return;
  for (let i = 0; i < gas.n; i++) {
    gas.vx[i] -= px / mt;
    gas.vy[i] -= py / mt;
  }
}

export function kineticEnergy(gas) {
  let e = 0;
  for (let i = 0; i < gas.n; i++) {
    e += 0.5 * gas.m[i] * (gas.vx[i] ** 2 + gas.vy[i] ** 2);
  }
  return e;
}

// Two quadratic degrees of freedom per disk: KE = N kT.
export function temperature(gas) {
  return gas.n === 0 ? 0 : kineticEnergy(gas) / gas.n;
}

export function setTemperature(gas, kT) {
  const now = temperature(gas);
  if (now <= 0) return;
  const s = Math.sqrt(kT / now);
  for (let i = 0; i < gas.n; i++) {
    gas.vx[i] *= s;
    gas.vy[i] *= s;
  }
}

export function packingFraction(gas) {
  let a = 0;
  for (let i = 0; i < gas.n; i++) a += Math.PI * gas.r[i] ** 2;
  return a / (gas.width * gas.height);
}

export function speed(gas, i) {
  return Math.hypot(gas.vx[i], gas.vy[i]);
}
