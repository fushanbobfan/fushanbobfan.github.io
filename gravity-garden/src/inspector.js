// Pure helpers for selecting a body under the pointer or keyboard and describing its
// live physical quantities. Kept free of DOM/canvas, like diagnostics.js and
// trajectory.js, so selection and stat-formatting logic can be tested on its own.

/**
 * Finds the body whose disc contains the given point, preferring the closest
 * center when discs overlap.
 * @param {{x:number,y:number,radius:number}[]} bodies
 * @param {number} x
 * @param {number} y
 * @returns {object|null}
 */
export function findBodyAtPoint(bodies, x, y) {
  let closest = null;
  let closestDist = Infinity;

  for (const body of bodies) {
    const dist = Math.hypot(body.x - x, body.y - y);
    if (dist <= body.radius && dist < closestDist) {
      closest = body;
      closestDist = dist;
    }
  }

  return closest;
}

export function speed(body) {
  return Math.hypot(body.vx, body.vy);
}

export function kineticEnergy(body) {
  return 0.5 * body.mass * (body.vx * body.vx + body.vy * body.vy);
}

/**
 * @param {object} body
 * @returns {{id:*, mass:number, x:number, y:number, speed:number, kineticEnergy:number}}
 */
export function describeBody(body) {
  return {
    id: body.id,
    mass: body.mass,
    x: body.x,
    y: body.y,
    speed: speed(body),
    kineticEnergy: kineticEnergy(body),
  };
}

/**
 * Finds the id of the body adjacent to `currentId` in array order, wrapping
 * around at either end. Falls back to the first (direction >= 0) or last
 * (direction < 0) body if there is no current selection, or if the
 * previously selected id is no longer present (e.g. it merged away).
 * @param {{id:*}[]} bodies
 * @param {*} currentId
 * @param {number} direction +1 for next, -1 for previous
 * @returns {*} the adjacent id, or null if `bodies` is empty
 */
export function adjacentBodyId(bodies, currentId, direction) {
  if (bodies.length === 0) return null;

  const index = currentId == null ? -1 : bodies.findIndex((b) => b.id === currentId);
  if (index === -1) {
    return direction >= 0 ? bodies[0].id : bodies[bodies.length - 1].id;
  }

  const nextIndex = (index + direction + bodies.length) % bodies.length;
  return bodies[nextIndex].id;
}

/**
 * Returns a new array with the body matching `id` removed, or the same
 * array (by reference) if no body has that id — e.g. it already merged
 * into another body since being selected.
 * @param {{id:*}[]} bodies
 * @param {*} id
 * @returns {object[]}
 */
export function removeBody(bodies, id) {
  const index = bodies.findIndex((b) => b.id === id);
  if (index === -1) return bodies;
  return [...bodies.slice(0, index), ...bodies.slice(index + 1)];
}
