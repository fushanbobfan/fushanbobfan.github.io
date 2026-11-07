// Sweeps a steady current slowly up and back down, the way a bifurcation is
// found in the lab.

import { SQUID, stableStep, steadyGates, step, temperatureFactor } from './hh.js';

// Firing rate against steady current, swept up and then back down without
// resetting the membrane between currents. The two directions disagree in the
// band where rest and repetitive firing are both stable.
export function* currentSweep(p, currents, { settle = 600, measure = 400, celsius = SQUID.temperature } = {}) {
  const phi = temperatureFactor(celsius);
  const dt = stableStep(celsius) * 2;
  const g = steadyGates(-65);
  const y = new Float64Array([-65, g.m, g.h, g.n]);
  const run = (current) => {
    const stimOf = () => current;
    const settleSteps = Math.ceil(settle / dt);
    for (let i = 0; i < settleSteps; i++) step(p, phi, y, 0, dt, stimOf);
    const measureSteps = Math.ceil(measure / dt);
    let count = 0;
    let previous = y[0];
    let first = null;
    let last = null;
    for (let i = 0; i < measureSteps; i++) {
      step(p, phi, y, 0, dt, stimOf);
      if (previous < 0 && y[0] >= 0) {
        const time = (i + (0 - previous) / (y[0] - previous)) * dt;
        if (first === null) first = time;
        last = time;
        count++;
      }
      previous = y[0];
    }
    return count >= 2 ? (1000 * (count - 1)) / (last - first) : 0;
  };
  for (const current of currents) yield { direction: 'up', current, rate: run(current) };
  for (let i = currents.length - 1; i >= 0; i--) {
    yield { direction: 'down', current: currents[i], rate: run(currents[i]) };
  }
}
