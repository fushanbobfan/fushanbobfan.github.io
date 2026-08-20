// Preset initial conditions for the simulation. Each preset returns a fresh array of
// bodies (never shared references) plus the gravitational constant it was tuned for.

function circularOrbitVelocity(G, centralMass, radius) {
  return Math.sqrt((G * centralMass) / radius);
}

export const PRESETS = {
  "sun-and-planets": {
    label: "Sun & Planets",
    G: 1,
    softening: 4,
    build() {
      const G = this.G;
      const sunMass = 20000;
      const sun = { mass: sunMass, x: 0, y: 0, vx: 0, vy: 0, radius: 14, color: "#ffd166" };

      const planets = [
        { dist: 90, mass: 8, radius: 4, color: "#4cc9f0" },
        { dist: 150, mass: 14, radius: 6, color: "#f72585" },
        { dist: 220, mass: 5, radius: 3, color: "#90f1ef" },
      ].map((p) => {
        const speed = circularOrbitVelocity(G, sunMass, p.dist);
        return {
          mass: p.mass,
          x: p.dist,
          y: 0,
          vx: 0,
          vy: speed,
          radius: p.radius,
          color: p.color,
        };
      });

      return [sun, ...planets];
    },
  },

  "binary-star": {
    label: "Binary Star + Planet",
    G: 1,
    softening: 4,
    build() {
      const G = this.G;
      const massA = 9000;
      const massB = 6000;
      const separation = 120;
      const totalMass = massA + massB;

      // Distances from the shared center of mass, and the orbital speed that
      // keeps both stars in a stable circular orbit around that center.
      const distA = (massB / totalMass) * separation;
      const distB = (massA / totalMass) * separation;
      const omega = Math.sqrt((G * totalMass) / (separation ** 3));

      const starA = {
        mass: massA,
        x: -distA,
        y: 0,
        vx: 0,
        vy: -omega * distA,
        radius: 12,
        color: "#ffd166",
      };
      const starB = {
        mass: massB,
        x: distB,
        y: 0,
        vx: 0,
        vy: omega * distB,
        radius: 9,
        color: "#ef476f",
      };

      const planetDist = 260;
      const planetSpeed = circularOrbitVelocity(G, totalMass, planetDist);
      const planet = {
        mass: 3,
        x: 0,
        y: -planetDist,
        vx: planetSpeed,
        vy: 0,
        radius: 4,
        color: "#06d6a0",
      };

      return [starA, starB, planet];
    },
  },

  "figure-eight": {
    label: "Figure-Eight Three-Body",
    G: 1,
    softening: 0.05,
    // Chenciner-Montgomery choreography: three equal masses chase each other
    // around a stable figure-eight curve forever (in the idealized point-mass limit).
    build() {
      const scale = 140;
      const speed = 90;
      return [
        {
          mass: 1000,
          x: 0.97000436 * scale,
          y: -0.24308753 * scale,
          vx: 0.4662036850 * speed,
          vy: 0.4323657300 * speed,
          radius: 6,
          color: "#4cc9f0",
        },
        {
          mass: 1000,
          x: -0.97000436 * scale,
          y: 0.24308753 * scale,
          vx: 0.4662036850 * speed,
          vy: 0.4323657300 * speed,
          radius: 6,
          color: "#f72585",
        },
        {
          mass: 1000,
          x: 0,
          y: 0,
          vx: -0.9324073700 * speed,
          vy: -0.8647314600 * speed,
          radius: 6,
          color: "#ffd166",
        },
      ];
    },
  },

  "rogue-flyby": {
    label: "Rogue Flyby",
    G: 1,
    softening: 4,
    // A stable sun-and-planet pair plus a fast interloper on a hyperbolic
    // path, demonstrating a gravitational slingshot: the rogue body's course
    // bends sharply near closest approach but it is moving far too fast to
    // be captured into orbit.
    build() {
      const G = this.G;
      const sunMass = 15000;
      const sun = { mass: sunMass, x: 0, y: 0, vx: 0, vy: 0, radius: 14, color: "#ffd166" };

      const planetDist = 140;
      const planet = {
        mass: 10,
        x: planetDist,
        y: 0,
        vx: 0,
        vy: circularOrbitVelocity(G, sunMass, planetDist),
        radius: 5,
        color: "#4cc9f0",
      };

      const rogue = {
        mass: 15,
        x: -600,
        y: 60,
        vx: 22,
        vy: 0,
        radius: 4,
        color: "#ff006e",
      };

      return [sun, planet, rogue];
    },
  },

  "planet-and-moon": {
    label: "Sun, Planet & Moon",
    G: 1,
    softening: 1,
    // A hierarchical three-body system: a moon in circular orbit around a planet, which is
    // itself in circular orbit around the sun. The moon's velocity is its own orbital speed
    // around the planet added to the planet's orbital speed around the sun, so the moon
    // travels with the planet through space while also circling it — the same nested-orbit
    // structure a real moon has, rather than an independent body that merely starts out near
    // the planet. The moon's distance is kept well inside the planet's Hill sphere (the region
    // where the planet's own gravity dominates over the sun's tidal pull, roughly
    // `planetDist * cbrt(planetMass / (3 * sunMass))` ≈ 24 here) — a moon placed outside it
    // gets pulled away by the sun within a few orbits instead of staying bound to the planet.
    build() {
      const G = this.G;
      const sunMass = 20000;
      const sun = { mass: sunMass, x: 0, y: 0, vx: 0, vy: 0, radius: 14, color: "#ffd166" };

      const planetMass = 150;
      const planetDist = 180;
      const planetSpeed = circularOrbitVelocity(G, sunMass, planetDist);
      const planet = {
        mass: planetMass,
        x: planetDist,
        y: 0,
        vx: 0,
        vy: planetSpeed,
        radius: 7,
        color: "#4cc9f0",
      };

      const moonDist = 8;
      const moonSpeed = circularOrbitVelocity(G, planetMass, moonDist);
      const moon = {
        mass: 2,
        x: planetDist + moonDist,
        y: 0,
        vx: 0,
        vy: planetSpeed + moonSpeed,
        radius: 2,
        color: "#e0e1dd",
      };

      return [sun, planet, moon];
    },
  },

  "trojan-asteroid": {
    label: "Trojan Asteroid",
    G: 1,
    softening: 2,
    // A small body sitting at the planet's leading Lagrange point (L4), 60 degrees ahead of it
    // along the same circular orbit — real Trojan asteroids cluster at Jupiter's L4/L5 points
    // the same way. At L4 the sun, planet, and trojan form an equilateral triangle, so placing
    // the trojan at the planet's own orbital distance and at the planet's own angular velocity
    // (same speed, direction rotated 60 degrees) sets up that triangle at t=0. It stays there:
    // the planet is only about 1/200th the sun's mass here, comfortably under the ~1/25 Routh
    // stability limit for L4/L5, so the sun's gravity dominates and the planet's own pull just
    // keeps the trojan librating near L4 instead of pulling it away.
    build() {
      const G = this.G;
      const sunMass = 20000;
      const sun = { mass: sunMass, x: 0, y: 0, vx: 0, vy: 0, radius: 14, color: "#ffd166" };

      const planetDist = 160;
      const planetMass = 100;
      const planetSpeed = circularOrbitVelocity(G, sunMass, planetDist);
      const planet = {
        mass: planetMass,
        x: planetDist,
        y: 0,
        vx: 0,
        vy: planetSpeed,
        radius: 6,
        color: "#4cc9f0",
      };

      const angle = Math.PI / 3;
      const trojan = {
        mass: 1,
        x: planetDist * Math.cos(angle),
        y: planetDist * Math.sin(angle),
        vx: -planetSpeed * Math.sin(angle),
        vy: planetSpeed * Math.cos(angle),
        radius: 2,
        color: "#06d6a0",
      };

      return [sun, planet, trojan];
    },
  },

  "random-cluster": {
    label: "Random Cluster",
    G: 1,
    softening: 6,
    build() {
      const bodies = [];
      const count = 24;
      const colors = ["#4cc9f0", "#f72585", "#ffd166", "#06d6a0", "#90f1ef", "#ef476f"];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 220;
        const mass = 20 + Math.random() * 200;
        bodies.push({
          mass,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          radius: 2 + mass / 60,
          color: colors[i % colors.length],
        });
      }
      return bodies;
    },
  },
};

export function listPresetNames() {
  return Object.keys(PRESETS);
}
