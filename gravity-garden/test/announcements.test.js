import test from "node:test";
import assert from "node:assert/strict";
import { describeMerge, describeRemoval } from "../src/announcements.js";

test("describeMerge returns null when the body count didn't drop", () => {
  assert.equal(describeMerge(5, 5), null);
});

test("describeMerge returns null if the count somehow increased", () => {
  assert.equal(describeMerge(5, 6), null);
});

test("describeMerge states the before and after counts for a single merge", () => {
  assert.equal(describeMerge(5, 4), "Bodies collided and merged: 5 became 4.");
});

test("describeMerge is accurate for multiple merges landing in the same tick", () => {
  assert.equal(describeMerge(6, 3), "Bodies collided and merged: 6 became 3.");
});

test("describeRemoval uses singular phrasing for exactly one remaining body", () => {
  assert.equal(describeRemoval(1), "Removed the selected body. 1 body remains.");
});

test("describeRemoval uses plural phrasing otherwise, including zero", () => {
  assert.equal(describeRemoval(3), "Removed the selected body. 3 bodies remain.");
  assert.equal(describeRemoval(0), "Removed the selected body. 0 bodies remain.");
});
