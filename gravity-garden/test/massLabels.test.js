import test from "node:test";
import assert from "node:assert/strict";
import { formatMassLabel, massLabelPosition } from "../src/massLabels.js";

test("formatMassLabel prints small masses as-is", () => {
  assert.equal(formatMassLabel(8), "8");
  assert.equal(formatMassLabel(1), "1");
});

test("formatMassLabel rounds a small mass to one decimal place", () => {
  assert.equal(formatMassLabel(14.53), "14.5");
});

test("formatMassLabel drops a trailing .0", () => {
  assert.equal(formatMassLabel(15.0), "15");
});

test("formatMassLabel abbreviates masses of 1000 or more with a 'k' suffix", () => {
  assert.equal(formatMassLabel(20000), "20k");
  assert.equal(formatMassLabel(1000), "1k");
});

test("formatMassLabel keeps one decimal place on an abbreviated mass when it matters", () => {
  assert.equal(formatMassLabel(8500), "8.5k");
});

test("formatMassLabel treats non-finite or non-positive mass as 0", () => {
  assert.equal(formatMassLabel(NaN), "0");
  assert.equal(formatMassLabel(Infinity), "0");
  assert.equal(formatMassLabel(0), "0");
  assert.equal(formatMassLabel(-5), "0");
});

test("massLabelPosition centers the label horizontally on the body", () => {
  const pos = massLabelPosition(120, 80, 10);
  assert.equal(pos.x, 120);
});

test("massLabelPosition places the label below the body, clear of its radius", () => {
  const small = massLabelPosition(0, 0, 4);
  const large = massLabelPosition(0, 0, 40);
  assert.ok(small.y > 4, "label should sit past the body's radius");
  assert.ok(large.y > small.y, "a bigger body's label should sit further down");
});

test("massLabelPosition treats a non-finite or negative radius as zero", () => {
  const pos = massLabelPosition(5, 5, NaN);
  assert.equal(pos.y, massLabelPosition(5, 5, 0).y);

  const negative = massLabelPosition(5, 5, -10);
  assert.equal(negative.y, massLabelPosition(5, 5, 0).y);
});
