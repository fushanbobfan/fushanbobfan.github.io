import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, listPresetNames } from "../src/presets.js";

test("listPresetNames matches the keys of PRESETS", () => {
  assert.deepEqual(listPresetNames(), Object.keys(PRESETS));
  assert.ok(listPresetNames().length > 0);
});

for (const key of Object.keys(PRESETS)) {
  const preset = PRESETS[key];

  test(`preset "${key}" builds at least two bodies with valid, finite fields`, () => {
    const bodies = preset.build();
    assert.ok(bodies.length >= 2, "a scenario needs at least two bodies to interact");

    for (const body of bodies) {
      for (const field of ["mass", "x", "y", "vx", "vy", "radius"]) {
        assert.ok(Number.isFinite(body[field]), `${field} should be a finite number`);
      }
      assert.ok(body.mass > 0, "mass must be positive");
      assert.ok(body.radius > 0, "radius must be positive");
      assert.equal(typeof body.color, "string");
    }
  });

  test(`preset "${key}" has a positive gravitational constant and softening`, () => {
    assert.ok(preset.G > 0);
    assert.ok(preset.softening >= 0);
  });
}

test('preset "sun-and-planets" is deterministic across repeated builds', () => {
  const first = PRESETS["sun-and-planets"].build();
  const second = PRESETS["sun-and-planets"].build();
  assert.deepEqual(first, second);
});

test('preset "random-cluster" returns a fresh, independent array each call', () => {
  const first = PRESETS["random-cluster"].build();
  const second = PRESETS["random-cluster"].build();
  assert.notEqual(first, second);
  assert.equal(first.length, second.length);
});
