// Pure math for drawing each body's net gravitational acceleration as an arrow: how long the
// shaft should be on screen, and where its tip lands in world space. The sibling of
// velocityVectors.js — same sqrt-compression-and-clamp approach — kept DOM-free so the scaling
// logic can be tested without a canvas.
//
// Where the velocity arrow shows which way a body is *moving*, the acceleration arrow shows
// which way it is being *pulled* right now. In a circular orbit the two are perpendicular; in
// a slingshot they swing wildly out of step. Seeing both at once is the quickest way to build
// intuition for why orbits curve.
//
// Acceleration magnitude spans an even wider range than speed (it climbs as 1/r^2 as two
// bodies approach, bounded only by the softening length), so a linear world-units-per-unit-
// acceleration scale is hopeless: distant bodies would show nothing and a close pass would
// throw an arrow clear off the canvas. `accelerationArrowLength` scales by the square root of
// the magnitude and then clamps to a minimum (so a body in a gentle field still shows a
// direction) and a maximum (so a close encounter doesn't dwarf the scene).

/**
 * The on-screen (world-unit) length an arrow should be drawn at for a given acceleration
 * magnitude. Zero (or any non-finite input) yields exactly `minLength`, so a body in
 * free fall far from everything still shows a minimal marker rather than a zero-length or
 * NaN arrow.
 *
 * @param {number} magnitude magnitude of the body's acceleration, world units per unit time^2
 * @param {number} scale user-adjustable multiplier on the base sqrt(magnitude) length
 * @param {number} minLength shortest length an arrow is ever drawn at
 * @param {number} maxLength longest length an arrow is ever drawn at
 */
export function accelerationArrowLength(magnitude, scale, minLength, maxLength) {
  const m = Number.isFinite(magnitude) ? Math.max(magnitude, 0) : 0;
  const raw = Math.sqrt(m) * scale;
  return Math.min(Math.max(raw, minLength), maxLength);
}

/**
 * The world-space shaft of a body's acceleration arrow: starts at the body's own position and
 * points in the direction of the net force on it, at a length from `accelerationArrowLength`.
 * A body with zero (or non-finite) acceleration points along +x, purely so the arrow has
 * *some* direction to draw rather than collapsing to a point.
 *
 * The acceleration components are passed in rather than recomputed here, so this module stays
 * independent of the N-body force code; the caller gets them from
 * `computeAccelerations` in physics.js.
 *
 * @param {{x:number,y:number}} body
 * @param {number} ax net acceleration, x component
 * @param {number} ay net acceleration, y component
 * @param {number} scale
 * @param {number} minLength
 * @param {number} maxLength
 * @returns {{x1:number,y1:number,x2:number,y2:number,magnitude:number}} shaft endpoints in
 *   world space, plus the raw acceleration magnitude (handy for a numeric readout without
 *   recomputing it)
 */
export function computeAccelerationArrow(body, ax, ay, scale, minLength, maxLength) {
  const axSafe = Number.isFinite(ax) ? ax : 0;
  const aySafe = Number.isFinite(ay) ? ay : 0;
  const magnitude = Math.hypot(axSafe, aySafe);
  const length = accelerationArrowLength(magnitude, scale, minLength, maxLength);
  const angle = magnitude > 0 ? Math.atan2(aySafe, axSafe) : 0;

  return {
    x1: body.x,
    y1: body.y,
    x2: body.x + Math.cos(angle) * length,
    y2: body.y + Math.sin(angle) * length,
    magnitude,
  };
}
