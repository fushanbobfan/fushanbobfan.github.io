import test from "node:test";
import assert from "node:assert/strict";
import {
  createDiagnosticsHistory,
  resetDiagnosticsHistory,
  recordSample,
  DEFAULT_HISTORY_LENGTH,
} from "../src/diagnostics.js";

test("createDiagnosticsHistory starts empty with no baseline", () => {
  const history = createDiagnosticsHistory();
  assert.equal(history.baseline, null);
  assert.deepEqual(history.samples, []);
  assert.equal(history.maxLength, DEFAULT_HISTORY_LENGTH);
});

test("the first recorded sample becomes the baseline and reads as zero drift", () => {
  const history = createDiagnosticsHistory();
  const sample = recordSample(history, -50, 3);

  assert.deepEqual(history.baseline, { energy: -50, momentumMagnitude: 3 });
  assert.equal(sample.energyDriftPct, 0);
  assert.equal(sample.momentumDrift, 0);
});

test("later samples are expressed as drift relative to the baseline", () => {
  const history = createDiagnosticsHistory();
  recordSample(history, -50, 0);

  const sample = recordSample(history, -45, 0.5);
  assert.equal(sample.energyDriftPct, 10); // (-45 - -50) / 50 * 100
  assert.equal(sample.momentumDrift, 0.5);
});

test("a zero-energy baseline is treated as scale 1 instead of dividing by zero", () => {
  const history = createDiagnosticsHistory();
  recordSample(history, 0, 0);

  const sample = recordSample(history, 2, 0);
  assert.equal(sample.energyDriftPct, 200);
  assert.ok(Number.isFinite(sample.energyDriftPct));
});

test("history is capped at maxLength, dropping the oldest sample first", () => {
  const history = createDiagnosticsHistory(3);
  recordSample(history, -10, 0);
  recordSample(history, -10, 0);
  recordSample(history, -10, 0);
  recordSample(history, -9, 0);

  assert.equal(history.samples.length, 3);
  // The very first (baseline) sample should have been the one dropped.
  assert.equal(history.samples[2].energyDriftPct, 10);
});

test("resetDiagnosticsHistory clears the baseline and all samples", () => {
  const history = createDiagnosticsHistory();
  recordSample(history, -50, 0);
  recordSample(history, -48, 0);

  resetDiagnosticsHistory(history);
  assert.equal(history.baseline, null);
  assert.deepEqual(history.samples, []);

  // The next sample after a reset establishes a fresh baseline again.
  const sample = recordSample(history, -20, 0);
  assert.equal(sample.energyDriftPct, 0);
});
