// Pure helpers for "drag to launch": grabbing an existing body and dragging away from
// it previews a velocity vector, released to set the body's actual velocity. Kept
// DOM-free, like physics.js and viewport.js, so the math can be tested without a canvas.

// World-units-of-velocity per world-unit of drag distance. Chosen so a drag across a
// typical preset's scale (tens to low hundreds of world units) lands in the same speed
// range the built-in presets already use (see src/presets.js), rather than needing an
// extreme drag to reach an orbital speed.
export const LAUNCH_VELOCITY_SCALE = 0.6;

/**
 * The velocity a release would impart right now: the vector from the body's position to
 * the pointer's current world position, scaled down from a drag distance into a speed.
 * Dragging farther from the body launches it faster in that direction, and dragging back
 * over the body itself cancels out to a stop.
 */
export function launchVelocityFrom(bodyX, bodyY, pointerX, pointerY, scale = LAUNCH_VELOCITY_SCALE) {
  return {
    vx: (pointerX - bodyX) * scale,
    vy: (pointerY - bodyY) * scale,
  };
}
