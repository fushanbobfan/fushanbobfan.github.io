import test from "node:test";
import assert from "node:assert/strict";
import { createGrid, setNodeType, setNodeWeight, START, END } from "../src/grid.js";
import {
  encodeGridToFragment,
  decodeGridFromFragment,
  buildShareUrl,
  extractShareFragment,
} from "../src/shareLink.js";

function sampleGrid() {
  let grid = createGrid(3, 4);
  grid = setNodeType(grid, 0, 0, START);
  grid = setNodeType(grid, 2, 3, END);
  grid = setNodeWeight(grid, 1, 1, 5);
  return grid;
}

test("encodeGridToFragment -> decodeGridFromFragment round-trips the grid", () => {
  const grid = sampleGrid();
  const fragment = encodeGridToFragment(grid);
  const restored = decodeGridFromFragment(fragment, 3, 4);
  assert.deepEqual(restored, grid);
});

test("encodeGridToFragment produces a URL-safe base64 string", () => {
  const fragment = encodeGridToFragment(sampleGrid());
  assert.match(fragment, /^[A-Za-z0-9+/]+=*$/);
});

test("decodeGridFromFragment rejects an empty fragment", () => {
  assert.throws(() => decodeGridFromFragment("", 3, 4), /no grid data/);
});

test("decodeGridFromFragment rejects a missing fragment", () => {
  assert.throws(() => decodeGridFromFragment(undefined, 3, 4), /no grid data/);
});

test("decodeGridFromFragment rejects invalid base64", () => {
  assert.throws(() => decodeGridFromFragment("not-valid-base64!!", 3, 4), /not valid base64/);
});

test("decodeGridFromFragment rejects base64 that isn't JSON", () => {
  const fragment = btoa("not json");
  assert.throws(() => decodeGridFromFragment(fragment, 3, 4), /not valid JSON/);
});

test("decodeGridFromFragment rejects a well-formed but size-mismatched grid", () => {
  const fragment = encodeGridToFragment(sampleGrid());
  assert.throws(() => decodeGridFromFragment(fragment, 5, 5), /size mismatch/);
});

test("buildShareUrl attaches the encoded grid as the URL's hash", () => {
  const grid = sampleGrid();
  const url = buildShareUrl(grid, "https://example.com/pathlight/");
  const parsed = new URL(url);

  assert.equal(parsed.origin + parsed.pathname, "https://example.com/pathlight/");
  const fragment = extractShareFragment(parsed.hash);
  assert.deepEqual(decodeGridFromFragment(fragment, 3, 4), grid);
});

test("buildShareUrl replaces an existing hash rather than appending to it", () => {
  const url = buildShareUrl(sampleGrid(), "https://example.com/#old=1");
  assert.equal((url.match(/#/g) || []).length, 1);
  assert.doesNotMatch(url, /old=1/);
});

test("extractShareFragment returns null when there is no hash", () => {
  assert.equal(extractShareFragment(""), null);
  assert.equal(extractShareFragment(undefined), null);
});

test("extractShareFragment returns null when the hash has no share parameter", () => {
  assert.equal(extractShareFragment("#foo=bar"), null);
});

test("extractShareFragment works with or without a leading '#'", () => {
  const fragment = encodeGridToFragment(sampleGrid());
  assert.equal(extractShareFragment(`#share=${fragment}`), fragment);
  assert.equal(extractShareFragment(`share=${fragment}`), fragment);
});
