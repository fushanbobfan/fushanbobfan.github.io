// Newtonian N-body gravity: pairwise forces integrated with velocity Verlet (leapfrog).
// A small softening length keeps accelerations finite when two bodies pass close together,
// which is the standard trick used in N-body codes to avoid a 1/r^2 singularity.

export const DEFAULT_SOFTENING = 0.05;

/**
 * @param {{mass:number,x:number,y:number}[]} bodies
 * @param {number} G
 * @param {number} softening
 * @returns {{ax:number, ay:number}[]} acceleration of each body, index-aligned with bodies
 */
export function computeAccelerations(bodies, G, softening = DEFAULT_SOFTENING) {
  const n = bodies.length;
  const acc = Array.from({ length: n }, () => ({ ax: 0, ay: 0 }));
  const eps2 = softening * softening;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      const dist2 = dx * dx + dy * dy + eps2;
      const invDist3 = 1 / (dist2 * Math.sqrt(dist2));

      const fi = G * bodies[j].mass * invDist3;
      acc[i].ax += fi * dx;
      acc[i].ay += fi * dy;

      const fj = G * bodies[i].mass * invDist3;
      acc[j].ax -= fj * dx;
      acc[j].ay -= fj * dy;
    }
  }
  return acc;
}

/**
 * Advances the system in place by one step of dt using velocity Verlet.
 * @param {object[]} bodies mutated in place: x, y, vx, vy are updated
 * @param {number} dt
 * @param {number} G
 * @param {number} softening
 */
export function stepSimulation(bodies, dt, G, softening = DEFAULT_SOFTENING) {
  const a0 = computeAccelerations(bodies, G, softening);

  for (let i = 0; i < bodies.length; i++) {
    bodies[i].x += bodies[i].vx * dt + 0.5 * a0[i].ax * dt * dt;
    bodies[i].y += bodies[i].vy * dt + 0.5 * a0[i].ay * dt * dt;
  }

  const a1 = computeAccelerations(bodies, G, softening);

  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vx += 0.5 * (a0[i].ax + a1[i].ax) * dt;
    bodies[i].vy += 0.5 * (a0[i].ay + a1[i].ay) * dt;
  }

  return bodies;
}

export function totalMomentum(bodies) {
  return bodies.reduce(
    (acc, b) => ({ px: acc.px + b.mass * b.vx, py: acc.py + b.mass * b.vy }),
    { px: 0, py: 0 }
  );
}

export function centerOfMass(bodies) {
  const totalMass = bodies.reduce((sum, b) => sum + b.mass, 0);
  const weighted = bodies.reduce(
    (acc, b) => ({ x: acc.x + b.mass * b.x, y: acc.y + b.mass * b.y }),
    { x: 0, y: 0 }
  );
  return { x: weighted.x / totalMass, y: weighted.y / totalMass };
}

/**
 * Merges bodies that overlap (distance between centers less than the sum of
 * their radii) into a single inelastic body, conserving total mass and
 * momentum. Returns a new array; the input is left untouched.
 * @param {object[]} bodies each needs mass, x, y, vx, vy, radius, color
 * @returns {object[]}
 */
export function mergeCollidingBodies(bodies) {
  const remaining = bodies.map((b) => ({ ...b }));
  const merged = [];

  while (remaining.length > 0) {
    let current = remaining.shift();

    // Keep re-scanning after every merge: growing `current` can now reach
    // bodies that were too far away to merge with it on an earlier pass.
    let mergedAny = true;
    while (mergedAny) {
      mergedAny = false;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const other = remaining[i];
        const dx = other.x - current.x;
        const dy = other.y - current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < current.radius + other.radius) {
          const totalMass = current.mass + other.mass;
          current = {
            mass: totalMass,
            x: (current.mass * current.x + other.mass * other.x) / totalMass,
            y: (current.mass * current.y + other.mass * other.y) / totalMass,
            vx: (current.mass * current.vx + other.mass * other.vx) / totalMass,
            vy: (current.mass * current.vy + other.mass * other.vy) / totalMass,
            radius: Math.sqrt(current.radius ** 2 + other.radius ** 2),
            color: current.mass >= other.mass ? current.color : other.color,
            trail: [],
          };
          remaining.splice(i, 1);
          mergedAny = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

export function totalEnergy(bodies, G, softening = DEFAULT_SOFTENING) {
  let kinetic = 0;
  for (const b of bodies) {
    kinetic += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy);
  }

  let potential = 0;
  const eps2 = softening * softening;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy + eps2);
      potential -= (G * bodies[i].mass * bodies[j].mass) / dist;
    }
  }

  return kinetic + potential;
}
