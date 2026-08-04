import test from "node:test";
import assert from "node:assert/strict";
import { pickNiceLength, computeScaleBar } from "../src/scaleBar.js";

function mantissa(n) {
  const exponent = Math.floor(Math.log10(n));
  return n / 10 ** exponent;
}

test("pickNiceLength returns a nice value for a plain target", () => {
  assert.equal(pickNiceLength(100), 100);
  assert.equal(pickNiceLength(1), 1);
});

test("pickNiceLength rounds an awkward target to the nearest nice mantissa", () => {
  // 60 sits between 50 and 100; on a log scale it's closer to 50 (the log-scale midpoint
  // between them is sqrt(50 * 100) ~= 70.7, and 60 falls below that).
  assert.equal(pickNiceLength(60), 50);
});

test("pickNiceLength always returns a 1/2/5 mantissa times a power of ten", () => {
  for (const target of [0.03, 0.9, 4, 17, 250, 9999]) {
    const nice = pickNiceLength(target);
    const m = Math.round(mantissa(nice) * 1000) / 1000;
    assert.ok([1, 2, 5].includes(m), `${nice} (mantissa ${m}) from target ${target}`);
  }
});

test("pickNiceLength treats zero, negative, and non-finite targets as the smallest nice length", () => {
  assert.equal(pickNiceLength(0), 1);
  assert.equal(pickNiceLength(-5), 1);
  assert.equal(pickNiceLength(NaN), 1);
});

test("computeScaleBar derives pixelLength from worldLength and zoom", () => {
  const bar = computeScaleBar(2, 100);
  assert.equal(bar.pixelLength, bar.worldLength * 2);
});

test("computeScaleBar picks a longer world length as zoom decreases, for a similar screen size", () => {
  const zoomedOut = computeScaleBar(0.2, 100);
  const zoomedIn = computeScaleBar(6, 100);
  assert.ok(zoomedOut.worldLength > zoomedIn.worldLength);
});

test("computeScaleBar keeps the pixel length within a reasonable band of the target", () => {
  for (const zoom of [0.2, 0.5, 1, 2, 3, 6]) {
    const bar = computeScaleBar(zoom, 100);
    assert.ok(bar.pixelLength > 40 && bar.pixelLength < 250, `zoom ${zoom} -> ${bar.pixelLength}px`);
  }
});
