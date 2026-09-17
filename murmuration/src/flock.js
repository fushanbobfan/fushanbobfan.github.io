// Reynolds' three flocking rules plus the two extra forces the app uses
// (edge avoidance and fleeing a point). Each rule returns a steering
// acceleration — desired velocity minus current velocity, capped at
// `maxForce` — so the caller can weight and sum them.

import { add, sub, scale, length, setMagnitude, limit, vec, fromAngle } from './vec.js';

export const DEFAULT_PARAMS = Object.freeze({
  perception: 50,        // neighbours within this radius influence a boid
  separationRadius: 25,  // only crowding closer than this pushes apart
  separation: 1.5,
  alignment: 1.0,
  cohesion: 1.0,
  maxSpeed: 3,
  maxForce: 0.08,
});

function steerTowards(desired, velocity, maxSpeed, maxForce) {
  if (desired.x === 0 && desired.y === 0) return vec();
  return limit(sub(setMagnitude(desired, maxSpeed), velocity), maxForce);
}

// Two boids sitting on exactly the same point have no direction to push
// along, so each picks one from its id. The golden angle spreads ids around
// the circle, so any two ids give clearly different directions.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function coincidentPush(boid) {
  return fromAngle((boid.id ?? 0) * GOLDEN_ANGLE);
}

// Push away from neighbours that are closer than `separationRadius`, with
// nearer neighbours pushing harder (inverse-distance weighting).
export function separation(boid, neighbours, params) {
  let sum = vec();
  let count = 0;
  for (const other of neighbours) {
    if (other === boid) continue;
    const away = sub(boid, other);
    const d = length(away);
    if (d >= params.separationRadius) continue;
    if (d === 0) sum = add(sum, coincidentPush(boid));
    else sum = add(sum, scale(away, 1 / (d * d)));
    count++;
  }
  if (count === 0) return vec();
  return steerTowards(sum, boid.vel, params.maxSpeed, params.maxForce);
}

// Steer to match the average velocity of the neighbours.
export function alignment(boid, neighbours, params) {
  let sum = vec();
  let count = 0;
  for (const other of neighbours) {
    if (other === boid) continue;
    sum = add(sum, other.vel);
    count++;
  }
  if (count === 0) return vec();
  return steerTowards(scale(sum, 1 / count), boid.vel, params.maxSpeed, params.maxForce);
}

// Steer towards the centre of mass of the neighbours.
export function cohesion(boid, neighbours, params) {
  let sum = vec();
  let count = 0;
  for (const other of neighbours) {
    if (other === boid) continue;
    sum = add(sum, other);
    count++;
  }
  if (count === 0) return vec();
  const centre = scale(sum, 1 / count);
  return steerTowards(sub(centre, boid), boid.vel, params.maxSpeed, params.maxForce);
}

// Weighted sum of the three rules.
export function flockingForce(boid, neighbours, params) {
  return add(
    add(
      scale(separation(boid, neighbours, params), params.separation),
      scale(alignment(boid, neighbours, params), params.alignment),
    ),
    scale(cohesion(boid, neighbours, params), params.cohesion),
  );
}

// Flee a point (the cursor "predator") when closer than `radius`. The force
// ramps up linearly from zero at the radius edge to full at the point.
export function flee(boid, point, radius, params) {
  const away = sub(boid, point);
  const d = length(away);
  if (d === 0 || d >= radius) return vec();
  const urgency = 1 - d / radius;
  return scale(steerTowards(away, boid.vel, params.maxSpeed, params.maxForce), urgency);
}

// Soft walls: within `margin` of an edge, steer back towards the interior.
// The turn is allowed several times the usual maxForce so a wall wins
// against cohesion pulling the flock outward.
export const EDGE_FORCE_MULTIPLIER = 3;

export function avoidEdges(boid, width, height, margin, params) {
  let desired = null;
  if (boid.x < margin) desired = vec(params.maxSpeed, boid.vel.y);
  else if (boid.x > width - margin) desired = vec(-params.maxSpeed, boid.vel.y);
  if (boid.y < margin) desired = vec(desired ? desired.x : boid.vel.x, params.maxSpeed);
  else if (boid.y > height - margin) desired = vec(desired ? desired.x : boid.vel.x, -params.maxSpeed);
  if (!desired) return vec();
  return steerTowards(desired, boid.vel, params.maxSpeed, params.maxForce * EDGE_FORCE_MULTIPLIER);
}
