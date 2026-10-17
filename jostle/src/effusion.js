// Effusion through the hole in the partition. For a dilute gas the number of
// disks crossing a gap of width w per unit time is
//   rate = n w sqrt(kT / 2 pi m),
// the one-dimensional Maxwell flux, where n is the number per unit area on
// the near side. Two species at the same temperature therefore leak at rates
// in the ratio sqrt(m_heavy / m_light) per unit density: Graham's law.

export function effusionRate(density, width, kT, mass) {
  return density * width * Math.sqrt(kT / (2 * Math.PI * mass));
}

export function grahamRatio(lightMass, heavyMass) {
  return Math.sqrt(heavyMass / lightMass);
}

// A disk's centre can only pass the gap where it clears both rims.
export function effectiveGap(hole, radius) {
  return Math.max(0, hole - 2 * radius);
}

// Counters for left-to-right and right-to-left crossings of the partition,
// per species, and each species' exposure: the integral over time of its
// number density on the left (and on the right), so measured rates can be
// compared with theory even as the left side empties.
export function createEffusion(gas) {
  const side = new Uint8Array(gas.n);
  const x = gas.partition ? gas.partition.x : gas.width / 2;
  for (let i = 0; i < gas.n; i++) side[i] = gas.x[i] < x ? 0 : 1;
  return {
    side,
    lr: [0, 0],
    rl: [0, 0],
    exposureLeft: [0, 0],
    exposureRight: [0, 0],
    elapsed: 0,
  };
}

export function sideCounts(gas, eff) {
  const counts = [[0, 0], [0, 0]];
  for (let i = 0; i < gas.n; i++) {
    if (gas.tracer && i === 0) continue;
    counts[eff.side[i]][gas.species[i]]++;
  }
  return counts;
}

// Call once per step, after the step, with its length.
export function updateEffusion(gas, eff, dt) {
  const x = gas.partition ? gas.partition.x : gas.width / 2;
  const first = gas.tracer ? 1 : 0;
  for (let i = first; i < gas.n; i++) {
    const now = gas.x[i] < x ? 0 : 1;
    if (now !== eff.side[i]) {
      if (now === 1) eff.lr[gas.species[i]]++;
      else eff.rl[gas.species[i]]++;
      eff.side[i] = now;
    }
  }
  const counts = sideCounts(gas, eff);
  const areaLeft = x * gas.height;
  const areaRight = (gas.width - x) * gas.height;
  for (let s = 0; s < 2; s++) {
    eff.exposureLeft[s] += (counts[0][s] / areaLeft) * dt;
    eff.exposureRight[s] += (counts[1][s] / areaRight) * dt;
  }
  eff.elapsed += dt;
}

// Measured crossings per unit gap width per unit density, in both directions
// pooled, for species s; comparable to sqrt(kT / 2 pi m).
export function measuredFlux(eff, s, gap) {
  const exposure = eff.exposureLeft[s] + eff.exposureRight[s];
  if (exposure <= 0 || gap <= 0) return NaN;
  return (eff.lr[s] + eff.rl[s]) / (exposure * gap);
}

// Mean free path of a disk of diameter d in a 2D gas of number density n:
// lambda = 1 / (sqrt(2) n d). Effusion needs lambda well above the hole
// width; when the hole is wider the gas pours through as a flow instead and
// leaks faster than the formula above.
export function meanFreePath(density, diameter) {
  if (density <= 0) return Infinity;
  return 1 / (Math.SQRT2 * density * diameter);
}
