// Tracks how far the simulation's conservation invariants (total energy, total momentum)
// have drifted from their value when tracking started. Kept separate from physics.js so it
// has no notion of "body" beyond the numbers it's handed, and can be unit tested without a
// DOM or canvas.

export const DEFAULT_HISTORY_LENGTH = 300;

export function createDiagnosticsHistory(maxLength = DEFAULT_HISTORY_LENGTH) {
  return { maxLength, baseline: null, samples: [] };
}

export function resetDiagnosticsHistory(history) {
  history.baseline = null;
  history.samples.length = 0;
}

/**
 * Records one (energy, momentum magnitude) sample. The first sample recorded after
 * creation or a reset becomes the baseline; every sample after that is expressed relative
 * to it, since raw energy/momentum units vary wildly between presets and are meaningless
 * on their own.
 *
 * Energy drift is a percentage of the baseline's magnitude, since bound systems have a
 * comfortably nonzero (negative) baseline energy. Momentum drift is left as an absolute
 * difference, since a symmetric system's baseline momentum is often ~0 and dividing by it
 * would blow up.
 *
 * @param {{maxLength:number, baseline:object|null, samples:object[]}} history
 * @param {number} energy
 * @param {number} momentumMagnitude
 * @returns {{energyDriftPct:number, momentumDrift:number}} the recorded sample
 */
export function recordSample(history, energy, momentumMagnitude) {
  if (history.baseline === null) {
    history.baseline = { energy, momentumMagnitude };
  }

  const energyScale = Math.abs(history.baseline.energy) || 1;
  const sample = {
    energyDriftPct: ((energy - history.baseline.energy) / energyScale) * 100,
    momentumDrift: momentumMagnitude - history.baseline.momentumMagnitude,
  };

  history.samples.push(sample);
  if (history.samples.length > history.maxLength) {
    history.samples.shift();
  }

  return sample;
}
