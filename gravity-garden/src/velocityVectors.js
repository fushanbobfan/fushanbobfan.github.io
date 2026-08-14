// Pure math for drawing each body's current velocity as an arrow: how long the shaft should
// be on screen, and where its tip lands in world space. Kept DOM-free like viewport.js and
// scaleBar.js so the scaling/clamping logic can be tested without a canvas.
//
// A body's speed can range from nearly stationary (a slow orbit) to extremely fast (a rogue
// flyby's interloper at closest approach), so drawing the shaft at a fixed world-units-per-
// unit-speed scale would make slow bodies invisible and fast ones fly off past the edge of the
// canvas. `arrowLength` instead scales by the square root of speed — compressing the huge range
// a linear scale would produce — and then clamps to a minimum (so even a near-stationary body
// still shows a visible direction) and a maximum (so an extreme flyby speed doesn't dwarf the
// rest of the scene).

/**
 * The on-screen (world-unit) length an arrow should be drawn at for a given speed. Zero speed
 * (or any non-finite input) yields exactly `minLength`, so a stationary body still shows a
 * minimal marker rather than a zero-length or NaN arrow.
 *
 * @param {number} speed magnitude of the body's velocity, world units per unit time
 * @param {number} scale user-adjustable multiplier on the base sqrt(speed) length
 * @param {number} minLength shortest length an arrow is ever drawn at
 * @param {number} maxLength longest length an arrow is ever drawn at
 */
export function arrowLength(speed, scale, minLength, maxLength) {
  const magnitude = Number.isFinite(speed) ? Math.max(speed, 0) : 0;
  const raw = Math.sqrt(magnitude) * scale;
  return Math.min(Math.max(raw, minLength), maxLength);
}

/**
 * The world-space shaft of a body's velocity arrow: starts at the body's own position and
 * points in the direction of travel, at a length from `arrowLength`. A body with zero (or
 * non-finite) velocity points along +x, purely so the arrow has *some* direction to draw
 * rather than collapsing to a point.
 *
 * @param {{x:number,y:number,vx:number,vy:number}} body
 * @param {number} scale
 * @param {number} minLength
 * @param {number} maxLength
 * @returns {{x1:number,y1:number,x2:number,y2:number,speed:number}} shaft endpoints in world
 *   space, plus the body's raw speed (handy for a numeric readout without recomputing it)
 */
export function computeVelocityArrow(body, scale, minLength, maxLength) {
  const vx = Number.isFinite(body.vx) ? body.vx : 0;
  const vy = Number.isFinite(body.vy) ? body.vy : 0;
  const speed = Math.hypot(vx, vy);
  const length = arrowLength(speed, scale, minLength, maxLength);
  const angle = speed > 0 ? Math.atan2(vy, vx) : 0;

  return {
    x1: body.x,
    y1: body.y,
    x2: body.x + Math.cos(angle) * length,
    y2: body.y + Math.sin(angle) * length,
    speed,
  };
}
