import test from "node:test";
import assert from "node:assert/strict";
import { serializeScenario, deserializeScenario } from "../src/scenario.js";

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

test("serializeScenario omits session-only fields (id, trail)", () => {
  const snapshot = serializeScenario(sampleState());
  for (const body of snapshot.bodies) {
    assert.equal(body.id, undefined);
    assert.equal(body.trail, undefined);
  }
});

test("serializeScenario -> deserializeScenario round-trips the physical state", () => {
  const state = sampleState();
  const snapshot = serializeScenario(state);
  const restored = deserializeScenario(JSON.parse(JSON.stringify(snapshot)));

  assert.equal(restored.G, state.G);
  assert.equal(restored.softening, state.softening);
  assert.deepEqual(restored.viewport, state.viewport);
  assert.deepEqual(
    restored.bodies,
    state.bodies.map(({ mass, x, y, vx, vy, radius, color }) => ({ mass, x, y, vx, vy, radius, color }))
  );
});

test("deserializeScenario defaults a missing viewport to centered, unzoomed", () => {
  const snapshot = serializeScenario(sampleState());
  delete snapshot.viewport;
  const restored = deserializeScenario(snapshot);
  assert.deepEqual(restored.viewport, { panX: 0, panY: 0, zoom: 1 });
});

test("deserializeScenario rejects a non-object payload", () => {
  assert.throws(() => deserializeScenario(null), /object/);
  assert.throws(() => deserializeScenario([1, 2, 3]), /object/);
  assert.throws(() => deserializeScenario("scenario"), /object/);
});

test("deserializeScenario rejects a non-positive or missing G", () => {
  assert.throws(() => deserializeScenario({ ...serializeScenario(sampleState()), G: 0 }), /G/);
  assert.throws(() => deserializeScenario({ ...serializeScenario(sampleState()), G: "1" }), /G/);
});

test("deserializeScenario rejects an empty or missing bodies array", () => {
  assert.throws(() => deserializeScenario({ ...serializeScenario(sampleState()), bodies: [] }), /at least one body/);
  assert.throws(() => deserializeScenario({ G: 1, softening: 1 }), /at least one body/);
});

test("deserializeScenario rejects a body with a non-finite field", () => {
  const snapshot = serializeScenario(sampleState());
  snapshot.bodies[0].mass = "heavy";
  assert.throws(() => deserializeScenario(snapshot), /mass/);
});

test("deserializeScenario rejects a body with non-positive mass or radius", () => {
  const negativeMass = serializeScenario(sampleState());
  negativeMass.bodies[0].mass = -5;
  assert.throws(() => deserializeScenario(negativeMass), /mass/);

  const zeroRadius = serializeScenario(sampleState());
  zeroRadius.bodies[0].radius = 0;
  assert.throws(() => deserializeScenario(zeroRadius), /radius/);
});

test("deserializeScenario rejects a body with a missing or empty color", () => {
  const snapshot = serializeScenario(sampleState());
  delete snapshot.bodies[0].color;
  assert.throws(() => deserializeScenario(snapshot), /color/);
});
