import test from "node:test";
import assert from "node:assert/strict";
import { formatElapsedTime } from "../src/elapsedTime.js";

test("formatElapsedTime renders sub-minute durations as m:ss", () => {
  assert.equal(formatElapsedTime(0), "0:00");
  assert.equal(formatElapsedTime(5), "0:05");
  assert.equal(formatElapsedTime(59), "0:59");
});

test("formatElapsedTime rolls over into minutes without padding the leading unit", () => {
  assert.equal(formatElapsedTime(60), "1:00");
  assert.equal(formatElapsedTime(125), "2:05");
  assert.equal(formatElapsedTime(3599), "59:59");
});

test("formatElapsedTime adds a padded hours segment once it reaches an hour", () => {
  assert.equal(formatElapsedTime(3600), "1:00:00");
  assert.equal(formatElapsedTime(3661), "1:01:01");
  assert.equal(formatElapsedTime(36000), "10:00:00");
});

test("formatElapsedTime truncates fractional seconds instead of rounding", () => {
  assert.equal(formatElapsedTime(59.9), "0:59");
  assert.equal(formatElapsedTime(0.5), "0:00");
});

test("formatElapsedTime treats negative or non-finite input as zero", () => {
  assert.equal(formatElapsedTime(-10), "0:00");
  assert.equal(formatElapsedTime(NaN), "0:00");
  assert.equal(formatElapsedTime(Infinity), "0:00");
});
