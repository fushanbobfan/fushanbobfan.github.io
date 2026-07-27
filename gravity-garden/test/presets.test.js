import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, listPresetNames } from "../src/presets.js";
import { stepSimulation } from "../src/physics.js";

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

test('preset "planet-and-moon" is deterministic across repeated builds', () => {
  const first = PRESETS["planet-and-moon"].build();
  const second = PRESETS["planet-and-moon"].build();
  assert.deepEqual(first, second);
});

test('preset "planet-and-moon" gives the moon the planet\'s velocity plus its own orbital speed', () => {
  const [, planet, moon] = PRESETS["planet-and-moon"].build();
  // The moon orbits purely in vy relative to the planet (both start at y = 0, x offset only),
  // so its absolute vy should be exactly the planet's plus the moon's own orbital contribution,
  // and its vx should match the planet's (zero) since neither has an x-component of velocity.
  assert.equal(moon.vx, planet.vx);
  assert.ok(moon.vy > planet.vy, "the moon's velocity should exceed the planet's it rides along with");
});

test('preset "planet-and-moon" keeps the moon bound to the planet over many orbits', () => {
  // A moon placed outside the planet's Hill sphere looks fine at t=0 (a valid, positive-distance
  // orbit) but gets pulled away by the sun's tidal force within a handful of orbits — the only
  // way to catch that is to actually integrate the system forward, not just inspect the initial
  // conditions. This mirrors how the app itself steps the simulation, just without a canvas.
  const preset = PRESETS["planet-and-moon"];
  const bodies = preset.build();
  const dt = 0.05;
  const initialMoonDist = Math.hypot(bodies[2].x - bodies[1].x, bodies[2].y - bodies[1].y);

  let maxMoonDist = initialMoonDist;
  for (let i = 0; i < 40000; i++) {
    stepSimulation(bodies, dt, preset.G, preset.softening);
    const [, planet, moon] = bodies;
    maxMoonDist = Math.max(maxMoonDist, Math.hypot(moon.x - planet.x, moon.y - planet.y));
  }

  // A stable orbit oscillates near its starting radius; an escaping moon's distance grows
  // essentially without bound, so a generous multiple of the initial distance safely separates
  // the two without the test being sensitive to the orbit's exact eccentricity.
  assert.ok(
    maxMoonDist < initialMoonDist * 3,
    `expected the moon to stay near its initial distance (${initialMoonDist.toFixed(1)}), got a max of ${maxMoonDist.toFixed(1)}`
  );
});

test('preset "random-cluster" returns a fresh, independent array each call', () => {
  const first = PRESETS["random-cluster"].build();
  const second = PRESETS["random-cluster"].build();
  assert.notEqual(first, second);
  assert.equal(first.length, second.length);
});
