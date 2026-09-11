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

test('preset "trojan-asteroid" places the trojan at an equal distance from the sun and the planet', () => {
  // The L4 Lagrange point forms an equilateral triangle with the sun and the planet, so at
  // t = 0 the trojan should be exactly as far from the sun as it is from the planet.
  const [sun, planet, trojan] = PRESETS["trojan-asteroid"].build();
  const sunDist = Math.hypot(trojan.x - sun.x, trojan.y - sun.y);
  const planetDist = Math.hypot(trojan.x - planet.x, trojan.y - planet.y);
  assert.ok(Math.abs(sunDist - planetDist) < 1e-9, `expected an equilateral triangle, got sunDist=${sunDist}, planetDist=${planetDist}`);
});

test('preset "trojan-asteroid" keeps the trojan librating near the L4 point over many orbits', () => {
  // Like the planet-and-moon Hill-sphere test, the only way to catch an escaping trojan is to
  // actually integrate the system forward rather than just inspect the initial conditions.
  const preset = PRESETS["trojan-asteroid"];
  const bodies = preset.build();
  const dt = 0.05;
  const [sun, planet, trojan] = bodies;
  const startDist = Math.hypot(trojan.x - sun.x, trojan.y - sun.y);

  let minDist = startDist;
  let maxDist = startDist;
  for (let i = 0; i < 40000; i++) {
    stepSimulation(bodies, dt, preset.G, preset.softening);
    const dist = Math.hypot(bodies[2].x - bodies[0].x, bodies[2].y - bodies[0].y);
    minDist = Math.min(minDist, dist);
    maxDist = Math.max(maxDist, dist);
  }

  // A librating trojan oscillates in a tight band around the planet's own orbital distance; an
  // escaping one would drift arbitrarily far. A generous +/-25% band safely separates the two
  // without the test being sensitive to the exact libration amplitude.
  assert.ok(
    minDist > startDist * 0.75 && maxDist < startDist * 1.25,
    `expected the trojan to stay near ${startDist.toFixed(1)}, got a range of ${minDist.toFixed(1)}-${maxDist.toFixed(1)}`
  );
});

test('preset "eccentric-orbit" is deterministic across repeated builds', () => {
  const first = PRESETS["eccentric-orbit"].build();
  const second = PRESETS["eccentric-orbit"].build();
  assert.deepEqual(first, second);
});

test('preset "eccentric-orbit" starts the planet at perihelion at the vis-viva speed', () => {
  const [sun, planet] = PRESETS["eccentric-orbit"].build();
  const a = 220;
  const e = 0.6;
  const perihelion = a * (1 - e);
  const dist = Math.hypot(planet.x - sun.x, planet.y - sun.y);
  const speed = Math.hypot(planet.vx, planet.vy);
  const expectedSpeed = Math.sqrt(PRESETS["eccentric-orbit"].G * sun.mass * (2 / perihelion - 1 / a));

  assert.ok(Math.abs(dist - perihelion) < 1e-9, `expected perihelion distance ${perihelion}, got ${dist}`);
  assert.ok(Math.abs(speed - expectedSpeed) < 1e-9, `expected vis-viva speed ${expectedSpeed}, got ${speed}`);
});

test('preset "eccentric-orbit" actually traces an ellipse: distance ranges between perihelion and aphelion, faster near the sun', () => {
  // Like the planet-and-moon Hill-sphere test, this integrates the system forward rather
  // than only checking the initial conditions, since the whole point of the preset is what
  // happens to speed and distance over the course of an orbit.
  const preset = PRESETS["eccentric-orbit"];
  const bodies = preset.build();
  const [sun, planet] = bodies;
  const a = 220;
  const e = 0.6;
  const perihelion = a * (1 - e);
  const aphelion = a * (1 + e);
  const dt = 0.05;
  // Kepler's third law for a central mass this much heavier than the planet: T = 2*pi*sqrt(a^3 / (G*M)).
  const period = 2 * Math.PI * Math.sqrt(a ** 3 / (preset.G * sun.mass));
  const steps = Math.ceil((period * 1.1) / dt);

  let minDist = Infinity;
  let maxDist = -Infinity;
  let speedAtMinDist = 0;
  let speedAtMaxDist = 0;
  for (let i = 0; i < steps; i++) {
    stepSimulation(bodies, dt, preset.G, preset.softening);
    const dist = Math.hypot(planet.x - sun.x, planet.y - sun.y);
    const speed = Math.hypot(planet.vx, planet.vy);
    if (dist < minDist) {
      minDist = dist;
      speedAtMinDist = speed;
    }
    if (dist > maxDist) {
      maxDist = dist;
      speedAtMaxDist = speed;
    }
  }

  assert.ok(Math.abs(minDist - perihelion) < perihelion * 0.01, `expected min distance near ${perihelion}, got ${minDist}`);
  assert.ok(Math.abs(maxDist - aphelion) < aphelion * 0.01, `expected max distance near ${aphelion}, got ${maxDist}`);
  assert.ok(
    speedAtMinDist > speedAtMaxDist,
    `Kepler's second law: expected the planet to move faster near perihelion (${speedAtMinDist}) than near aphelion (${speedAtMaxDist})`
  );
});

test('preset "random-cluster" returns a fresh, independent array each call', () => {
  const first = PRESETS["random-cluster"].build();
  const second = PRESETS["random-cluster"].build();
  assert.notEqual(first, second);
  assert.equal(first.length, second.length);
});
