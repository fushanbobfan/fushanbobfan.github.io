import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeScenarioToFragment,
  decodeScenarioFromFragment,
  buildShareUrl,
  extractShareFragment,
} from "../src/shareLink.js";

function sampleState() {
  return {
    bodies: [
      { mass: 20000, x: 0, y: 0, vx: 0, vy: 0, radius: 14, color: "#ffd166", id: 1, trail: [{ x: 0, y: 0 }] },
      { mass: 8, x: 90, y: 0, vx: 0, vy: 14.9, radius: 4, color: "#4cc9f0", id: 2, trail: [] },
    ],
    G: 1,
    softening: 4,
    viewport: { panX: 12, panY: -7, zoom: 1.5 },
  };
}

test("encodeScenarioToFragment -> decodeScenarioFromFragment round-trips the physical state", () => {
  const state = sampleState();
  const fragment = encodeScenarioToFragment(state);
  const restored = decodeScenarioFromFragment(fragment);

  assert.equal(restored.G, state.G);
  assert.equal(restored.softening, state.softening);
  assert.deepEqual(restored.viewport, state.viewport);
  assert.deepEqual(
    restored.bodies,
    state.bodies.map(({ mass, x, y, vx, vy, radius, color }) => ({ mass, x, y, vx, vy, radius, color }))
  );
});

test("encodeScenarioToFragment produces a URL-safe base64 string", () => {
  const fragment = encodeScenarioToFragment(sampleState());
  assert.match(fragment, /^[A-Za-z0-9+/]+=*$/);
});

test("decodeScenarioFromFragment rejects an empty fragment", () => {
  assert.throws(() => decodeScenarioFromFragment(""), /no scenario data/);
});

test("decodeScenarioFromFragment rejects a missing fragment", () => {
  assert.throws(() => decodeScenarioFromFragment(undefined), /no scenario data/);
});

test("decodeScenarioFromFragment rejects invalid base64", () => {
  assert.throws(() => decodeScenarioFromFragment("not-valid-base64!!"), /not valid base64/);
});

test("decodeScenarioFromFragment rejects base64 that isn't JSON", () => {
  const fragment = btoa("not json");
  assert.throws(() => decodeScenarioFromFragment(fragment), /not valid JSON/);
});

test("decodeScenarioFromFragment rejects a well-formed but invalid scenario", () => {
  const fragment = btoa(JSON.stringify({ G: -1, softening: 0, bodies: [] }));
  assert.throws(() => decodeScenarioFromFragment(fragment), /positive/);
});

test("buildShareUrl attaches the encoded scenario as the URL's hash", () => {
  const state = sampleState();
  const url = buildShareUrl(state, "https://example.com/gravity-garden/");
  const parsed = new URL(url);

  assert.equal(parsed.origin + parsed.pathname, "https://example.com/gravity-garden/");
  const fragment = extractShareFragment(parsed.hash);
  assert.deepEqual(decodeScenarioFromFragment(fragment), decodeScenarioFromFragment(encodeScenarioToFragment(state)));
});

test("buildShareUrl replaces an existing hash rather than appending to it", () => {
  const url = buildShareUrl(sampleState(), "https://example.com/#old=1");
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
  const fragment = encodeScenarioToFragment(sampleState());
  assert.equal(extractShareFragment(`#share=${fragment}`), fragment);
  assert.equal(extractShareFragment(`share=${fragment}`), fragment);
});
