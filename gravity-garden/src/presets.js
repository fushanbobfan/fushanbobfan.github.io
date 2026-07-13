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
